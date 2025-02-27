import {Scene, Mesh, TextureLoader, NearestFilter, MeshToonMaterial} from 'three'
import { World, RigidBodyDesc, ColliderDesc } from '@dimforge/rapier3d-compat'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default class Start {
  material = new MeshToonMaterial()

  constructor(scene: Scene, world: World, position: [number, number, number]) {
    const textureLoader = new TextureLoader()
    const gradientTexture = textureLoader.load('textures/gradients/5.jpg')
    gradientTexture.magFilter = NearestFilter

    new GLTFLoader().load('models/start.glb', (gltf) => {
      const mesh = gltf.scene.getObjectByName('Cylinder') as Mesh
      mesh.receiveShadow = true
      scene.add(mesh)

      this.material = new MeshToonMaterial({
        color: "#8F6618",
        gradientMap: gradientTexture
      })

      const body = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(...position))

      const points = new Float32Array(mesh.geometry.attributes.position.array)
      const shape = ColliderDesc.convexHull(points) as ColliderDesc

      world.createCollider(shape, body)

      mesh.position.copy(body.translation())
      mesh.quaternion.copy(body.rotation())
    })
  }
}