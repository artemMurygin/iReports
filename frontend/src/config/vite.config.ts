import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            // Файл лежит в src/config, поэтому '@' (== frontend/src) — это на уровень выше
            '@': path.resolve(__dirname, '../'),
        },
    },
    server: {
        allowedHosts: ['c7d3-2a0c-16c1-1-1500-225-c0ff-fe00-f.ngrok-free.app'],
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ''),
            },
        },
    },
    plugins: [react(), tailwindcss()],
})
