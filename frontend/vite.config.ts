// `vitest/config` re-exports Vite's `defineConfig` with the `test` key typed in (same trick as
// `sheets-app/vite.config.ts`), so this single file keeps doubling as both the Vite build config
// and the Vitest config — no separate `vitest.config.ts` needed.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    optimizeDeps: {
        // `ireports-contracts` is a `file:../contracts` workspace symlink (see package.json), so
        // Vite resolves it to a real path outside `node_modules` and — unlike a registry
        // dependency — skips esbuild's CJS→ESM pre-bundling for it by default. That's invisible
        // as long as only `export type` values are imported from it (erased at build time, as
        // every pre-Фаза-3 usage did), but breaks the moment real zod schema *values* are
        // imported at runtime (`ruleFormSchema.ts`'s `salaryRuleRequestSchema`) — the browser then
        // tries to load the package's CommonJS `dist/index.js` as native ESM and fails with
        // "does not provide an export named ...". Forcing it into `include` makes esbuild
        // pre-bundle (and CJS-interop) it like any other dependency.
        include: ['ireports-contracts'],
    },
    server: {
        allowedHosts: [
            'c7d3-2a0c-16c1-1-1500-225-c0ff-fe00-f.ngrok-free.app',
            '474e-94-183-255-240.ngrok-free.app',
        ],
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    plugins: [react(), tailwindcss()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
    },
})
