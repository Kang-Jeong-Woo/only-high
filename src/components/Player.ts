import {ActiveEvents, ColliderDesc, RigidBody, RigidBodyDesc, World} from '@dimforge/rapier3d-compat'
import {
    Euler, Matrix4, Object3D,
    PerspectiveCamera, Quaternion, Scene,
    Vector3, WebGLRenderer
} from 'three'
import AnimationController from '../UI/AnimationController.ts'
import FollowCam from '../UI/FollowCam.ts'
import Keyboard from '../UI/Keyboard.ts'
import UI from "../UI/UI.ts";

export default class Player {
    scene: Scene
    world: World
    ui: UI
    body: RigidBody
    animationController?: AnimationController
    vector = new Vector3()
    inputVelocity = new Vector3()
    euler = new Euler()
    quaternion = new Quaternion()
    followTarget = new Object3D()
    grounded = false
    rotationMatrix = new Matrix4()
    targetQuaternion = new Quaternion()
    followCam: FollowCam
    keyboard: Keyboard
    wait = false
    handle = -1

    constructor(scene: Scene, camera: PerspectiveCamera, renderer: WebGLRenderer, world: World, position: [number, number, number] = [0, 0, 0], ui: UI) {
        this.scene = scene
        this.world = world
        this.ui = ui
        this.keyboard = new Keyboard(renderer)
        this.followCam = new FollowCam(this.scene, camera, renderer)

        scene.add(this.followTarget)

        this.body = world.createRigidBody(
            RigidBodyDesc.dynamic()
                .setTranslation(...position)
                // enabledRotations 를 켜버리면 body 가 딱 서있지 않고 자꾸 쓰러짐.
                .enabledRotations(false, false, false)
                .setCanSleep(false)
        )
        this.handle = this.body.handle

        const shape = ColliderDesc.capsule(0.5, 0.15)
            .setTranslation(0, 0.645, 0)
            .setMass(1)
            .setFriction(0)
            // 여기 ActiveEvents 에 넣어줘야 world 의 EventQueue 에 넣어져서 동작한다.
            .setActiveEvents(ActiveEvents.COLLISION_EVENTS)

        world.createCollider(shape, this.body)
    }

    async init() {
        this.animationController = new AnimationController(this.scene, this.keyboard)
        await this.animationController.init()
    }

    setGrounded(grounded: boolean) {
        if (grounded != this.grounded) {
            this.grounded = grounded
            if (grounded) {
                this.body.setLinearDamping(4)
                setTimeout(() => {
                    this.wait = false
                }, 250)
            } else {
                this.body.setLinearDamping(0)
            }
        }
    }

    reset() {
        // 선속도를 0 으로 설정하는 이유는 리셋 되었을 때 죽기 직전에 속도가 유지되면 재설정 하고 나도 앞선 속도가 계승되기 때문이다.
        this.body.setLinvel(new Vector3(0, 0, 0), true)
        // 참고로 아래 주석처럼 각속도 바꿀 수 있다.
        // this.body.setAngvel(new Vector3(0, 0, 0), true)
        // 따라서 body 를 재설정 할 때 위 모든 속도들을 0 으로 설정해줘야하는데,
        // 그렇지 않으면 body, wheel 사아에 joint 가 서로 당겨서 순식간에 엄청난 힘이 발생하기 때문에 어디로 날아간다.
        this.body.setTranslation(new Vector3(0, 1, 0), true)
        this.ui.reset()
    }

    update(delta: number) {
        this.inputVelocity.set(0, 0, 0)
        // 공중에서 욺직일 수 없도록 하기위한 변수
        if (this.grounded) {
            if (this.keyboard.keyMap['KeyW']) {
                this.inputVelocity.z = -2
            }
            if (this.keyboard.keyMap['KeyS']) {
                this.inputVelocity.z = 2
            }
            if (this.keyboard.keyMap['KeyA']) {
                this.inputVelocity.x = -2
            }
            if (this.keyboard.keyMap['KeyD']) {
                this.inputVelocity.x = 2
            }

            // 시간에 맞춰 욺직일 수 있도록 delta 를 설정 후 벡터의 크기를 설정. => speed 임. default 는 2로 설정.
            this.inputVelocity.setLength(delta * (this.animationController?.speed || 2))

            if (!this.wait && this.keyboard.keyMap['Space']) {
                this.wait = true
                this.body.setLinearDamping(0)
                if (this.keyboard.keyMap['ShiftLeft']) {
                    this.inputVelocity.multiplyScalar(3)
                } else {
                    this.inputVelocity.multiplyScalar(1.5)
                }
                this.inputVelocity.y = 7
                // this.grounded = false
            }
        }

        // 카메라 방향에 맞춰 wasd 방향 변경.
        this.euler.y = this.followCam.yaw.rotation.y
        this.quaternion.setFromEuler(this.euler)
        this.inputVelocity.applyQuaternion(this.quaternion)

        // 생성한 capsule 을 inputVelocity 에 맞춰 욺직인다.
        this.body.applyImpulse(this.inputVelocity, true)

        // 낙(게임 오버)
        if (this.body.translation().y < -3) {
            this.reset()
        }

        // Custom Follow Camera 구현
        this.followTarget.position.copy(this.body.translation())
        this.followTarget.getWorldPosition(this.vector)
        this.followCam.pivot.position.lerp(this.vector, delta * 10)

        // model 도 vector 에 맞추서 욺직이도록 하지만 카메라보단 더 빠르게 반응하도록 *20 설정.
        this.animationController?.model?.position.lerp(this.vector, delta * 20)

        // rotationMatrix 를 생성 후 카메라, 모델이 특정 지점을 바라보도록 설정.
        this.rotationMatrix.lookAt(
            // 어디를 볼지
            this.followTarget.position,
            // 어디서 볼지
            this.animationController?.model?.position as Vector3,
            // 바라보는 객체의 위쪽 방향 벡터
            this.animationController?.model?.up as Vector3
        )

        // 케릭터 회전을 쿼터니언으로 조정. 짐볼 락 때문.
        this.targetQuaternion.setFromRotationMatrix(this.rotationMatrix)

        // 모델과 실제 body 사이의 거리를 계산 후 수가 굉장히 작아지면 무시하도록 설정 => 안 그러면 lerp 때문에 자꾸 모델이 여기저기를 봄.
        const distance = this.animationController?.model?.position.distanceTo(this.followTarget.position)
        if ((distance as number) > 0.0001 && !this.animationController?.model?.quaternion.equals(this.targetQuaternion)) {
            // 수평축을 제외하고 딱 고정.
            this.targetQuaternion.z = 0
            this.targetQuaternion.x = 0
            // 쿼터니언은 항상 사용하기 전에 normalise 를 해줘야함 !!!!
            this.targetQuaternion.normalize()
            this.animationController?.model?.quaternion.rotateTowards(this.targetQuaternion, delta * 20)
        }

        this.animationController?.update(delta)
    }
}