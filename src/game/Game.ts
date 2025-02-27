import { PerspectiveCamera, Scene, WebGLRenderer, Vector3 } from 'three'
import UI from '../UI/UI.ts'
import Player from '../components/Player.ts'
import Environment from '../UI/Environment.ts'
import RAPIER, { World, EventQueue } from '@dimforge/rapier3d-compat'
import RapierDebugRenderer from '../debug/RapierDebugRenderer.ts'
import Finish from '../components/Finish.ts'
import Spinner from '../components/Spinner.ts'
import Pendulum from '../components/Pendulum.ts'
import {ObstacleCourseGenerator} from "./ObstacleCourseGenerator.ts";

export default class Game {
    scene: Scene
    camera: PerspectiveCamera
    renderer: WebGLRenderer
    ui: UI
    player?: Player
    world?: World
    rapierDebugRenderer?: RapierDebugRenderer
    eventQueue?: EventQueue
    finish?: Finish
    spinners: Spinner[] = []
    pendulums: Pendulum[] = []

    constructor(scene: Scene, camera: PerspectiveCamera, renderer: WebGLRenderer) {
        this.scene = scene
        this.camera = camera
        this.renderer = renderer
        this.ui = new UI(this.renderer)
    }

    async init() {
        await RAPIER.init()
        const gravity = new Vector3(0.0, -9.81, 0.0)

        this.world = new World(gravity)
        // 모든 rigidbody 간 충돌 이벤트를 가져오는 이벤트 큐
        // this.world?.step 에 넘겨줘야 정상적으로 큐 안에 들어온다.
        this.eventQueue = new EventQueue(true)

        this.rapierDebugRenderer = new RapierDebugRenderer(this.scene, this.world)
        this.rapierDebugRenderer.enabled = false

        const courseGenerator = new ObstacleCourseGenerator(this.scene, this.world)
        const { platforms, spinners, pendulums } = courseGenerator.generate()
        this.spinners = spinners
        this.pendulums = pendulums

        const lastPlatform = platforms[platforms.length - 1]
        const finishPos:[number, number, number] = [
            lastPlatform.position[0],
            lastPlatform.position[1] + Math.random() * (5 - 2) + 2,
            lastPlatform.position[2] + 2
        ]

        this.finish = new Finish(this.scene, this.world, finishPos)

        this.player = new Player(this.scene, this.camera, this.renderer, this.world, [0, 0.1, 0], this.ui)
        await this.player.init()

        const environment = new Environment(this.scene)
        await environment.init()
        environment.light.target = this.player.followTarget

        this.ui.show()
    }

    update(delta: number) {
        this.spinners.forEach((s) => {
            s.update(delta)
        })
        ;(this.world as World).timestep = Math.min(delta, 0.1)
        this.world?.step(this.eventQueue)
        this.eventQueue?.drainCollisionEvents((handle1, handle2, started) => {
            if (started) {
                // 이벤트 큐에 들어온 rigidbody 가 finish 라면
                if ([handle1, handle2].includes(this.finish?.handle as number)) {
                    this.ui.showLevelCompleted()
                }
            }

            // 장애물에 hit 하면 다시 점프할 수 있도록 설정
            let hitSpinner = false
            this.spinners.forEach((s) => {
                if ([handle1, handle2].includes(s.handle)) {
                    hitSpinner = true
                }
            })
            let hitPendulum = false
            this.pendulums.forEach((p) => {
                if (p.handles.some((h) => [handle1, handle2].includes(h))) {
                    hitPendulum = true
                }
            })
            if (!hitSpinner && !hitPendulum) {
                this.player?.setGrounded(started)
            }
        })
        this.player?.update(delta)
        this.finish?.update(delta)
        this.pendulums.forEach((p) => {
            p.update()
        })
        this.rapierDebugRenderer?.update()
    }
}