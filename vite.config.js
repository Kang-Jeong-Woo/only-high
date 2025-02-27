import {defineConfig} from 'vite'
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
    assetsInclude: ['**/*.hdr', '**/*.glb'],
    plugins: [topLevelAwait()],
    base: './',
})