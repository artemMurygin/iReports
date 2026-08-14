import path from 'node:path'
// `vitest/config` re-exports Vite's `defineConfig` with the `test` key typed in, so this single
// file keeps doubling as both the Vite build config and the Vitest config (no separate
// vitest.config.ts needed).
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
    // viteSingleFile must run last so it inlines the CSS/JS Tailwind and React already produced.
    plugins: [react(), tailwindcss(), viteSingleFile()],
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
        },
    },
    build: {
        outDir: 'dist',
        assetsInlineLimit: 100000000,
        cssCodeSplit: false,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
    },
})
