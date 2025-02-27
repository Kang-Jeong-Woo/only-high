import {Scene, Vector3} from "three";
import {World} from "@dimforge/rapier3d-compat";
import Platform from "../components/Platform.ts";
import Spinner from "../components/Spinner.ts";
import Pendulum from "../components/Pendulum.ts";
import IObstacleConfig from "../components/interface/IObstacleConfig.ts";

export class ObstacleCourseGenerator {
    private readonly minPlatforms = 10
    private readonly maxPlatforms = 15
    private readonly maxSpinners = 2
    private readonly maxPendulums = 3
    private readonly maxHeight = 12
    private readonly courseWidth = 12
    private readonly courseLength = 20
    private readonly minPlatformSize = 1
    private readonly maxPlatformSize = 5

    constructor(
        private scene: Scene,
        private world: World
    ) {}

    generate(): { platforms: Platform[], spinners: Spinner[], pendulums: Pendulum[] } {
        const platforms: Platform[] = []
        const spinners: Spinner[] = []
        const pendulums: Pendulum[] = []

        // 시작 platform
        platforms.push(new Platform(this.scene, this.world, [2, 0.1, 2], [0, 0, 0]))
        const numPlatforms = this.randomInt(this.minPlatforms, this.maxPlatforms)
        let currentPos = new Vector3(0, 0, 2)
        let currentHeight = 0

        // 각 플랫폼 사기 평균 거리
        const avgLengthStep = this.courseLength / (numPlatforms + 1)
        const avgWidthStep = this.courseWidth / 2

        for (let i = 0; i < numPlatforms; i++) {
            const nextConfig = this.generateNextPlatformConfig(
                currentPos,
                currentHeight,
                avgLengthStep,
                avgWidthStep,
                i / numPlatforms
            )

            platforms.push(new Platform(
                this.scene,
                this.world,
                nextConfig.size || [3, 0.1, 3],
                nextConfig.position,
                nextConfig.rotation
            ))

            this.addObstaclesBetweenPlatforms(
                currentPos,
                new Vector3(...nextConfig.position),
                spinners,
                pendulums
            )

            currentPos = new Vector3(...nextConfig.position)
            currentHeight = nextConfig.position[1]
        }

        return { platforms, spinners, pendulums }
    }

    private generateNextPlatformConfig(
        currentPos: Vector3,
        //@ts-ignore
        currentHeight: number,
        avgLengthStep: number,
        avgWidthStep: number,
        progress: number
    ): IObstacleConfig {
        // 진행 상태에 따라 더 어렵게 설정.
        const forwardJump = avgLengthStep * (1 + progress * 0.5)
        const sideJump = avgWidthStep * (1 + progress * 0.3)

        let nextPos = currentPos.clone()
        let rotation: [number, number, number] = [0, 0, 0]

        nextPos.z += forwardJump
        nextPos.x += (Math.random() - 0.5) * sideJump * 2
        nextPos.y += this.randomFloat(1, 2) * (1 + progress)

        if (Math.random() < 0.4) {
            const angle = (Math.random() * Math.PI / 6) - (Math.PI / 12)
            rotation = [angle, 0, Math.random() * Math.PI / 8]
        }

        const size: [number, number, number] = [
            this.randomFloat(this.minPlatformSize, this.maxPlatformSize),
            0.1,
            this.randomFloat(this.minPlatformSize, this.maxPlatformSize)
        ]

        return {
            position: [nextPos.x, nextPos.y, nextPos.z],
            rotation,
            size,
            type: 'platform'
        }
    }

    private addObstaclesBetweenPlatforms(
        start: Vector3,
        end: Vector3,
        spinners: Spinner[],
        pendulums: Pendulum[]
    ): void {
        const distance = start.distanceTo(end)
        const direction = end.clone().sub(start).normalize()
        const numObstacles = Math.floor(distance / 3)  // One obstacle every 3 units

        for (let i = 1; i <= numObstacles; i++) {
            const progress = i / (numObstacles + 1)
            const obstaclePos = start.clone().add(direction.clone().multiplyScalar(distance * progress))

            // 원래 경로에 살짝 빗겨서 장애물 생성
            obstaclePos.x += (Math.random() - 0.5) * 2
            obstaclePos.y += Math.random() * 2

            // 장애물 번갈아가며 생성
            if (i % 2 === 0 && spinners.length < this.maxSpinners) {
                spinners.push(new Spinner(
                    this.scene,
                    this.world,
                    [obstaclePos.x, obstaclePos.y + 1, obstaclePos.z],
                    1 + (progress * 2)
                ))
            } else if (pendulums.length < this.maxPendulums) {
                const rotation = Math.random() < 0.5 ? 0 : Math.PI / 2
                pendulums.push(new Pendulum(
                    this.scene,
                    this.world,
                    [obstaclePos.x, obstaclePos.y + 3, obstaclePos.z],
                    rotation,
                ))
            }
        }
    }

    // @ts-ignore
    private shouldAddObstacle(height: number): boolean {
        const baseChance = 0.4  // Increased base chance
        const heightMultiplier = height / this.maxHeight
        return Math.random() < (baseChance + heightMultiplier * 0.5)
    }

    private randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    private randomFloat(min: number, max: number): number {
        return Math.random() * (max - min) + min
    }
}