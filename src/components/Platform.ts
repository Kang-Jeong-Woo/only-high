import { ColliderDesc, RigidBodyDesc, World } from '@dimforge/rapier3d-compat'
import {
    BoxGeometry,
    Euler,
    Mesh,
    MeshToonMaterial,
    NearestFilter,
    Quaternion,
    Scene,
    TextureLoader
} from 'three'

export default class Platform {
    material = new MeshToonMaterial()
    position: [number, number, number]

    constructor(scene: Scene, world: World, size: [number, number, number], position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) {
        this.position = position;
        const textureLoader = new TextureLoader()
        const gradientTexture = textureLoader.load('textures/gradients/5.jpg')
        gradientTexture.magFilter = NearestFilter
        this.material = new MeshToonMaterial({
            color: "#C7E047",
            gradientMap: gradientTexture
        })

        const mesh = new Mesh(new BoxGeometry(...size), this.material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        scene.add(mesh)

        const body = world.createRigidBody(
            RigidBodyDesc.fixed()
                .setTranslation(...position)
                .setRotation(new Quaternion().setFromEuler(new Euler(...rotation)))
        )

        const shape = ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)

        world.createCollider(shape, body)

        mesh.position.copy(body.translation())
        mesh.quaternion.copy(body.rotation())
    }
}