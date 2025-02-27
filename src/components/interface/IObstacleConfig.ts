export default interface IObstacleConfig {
    position: [number, number, number]
    rotation?: [number, number, number]
    size?: [number, number, number]
    type: 'platform' | 'spinner' | 'pendulum'
}