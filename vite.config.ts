import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        proxy: {
            '/api': {
                target: 'https://smartidbackend.vercel.app',
                changeOrigin: true,
                secure: true,
            },
            '/socket.io': {
                target: 'https://smartidbackend.vercel.app',
                changeOrigin: true,
                secure: true,
                ws: true,
            },
        },
    },
})
