import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ═══════════════════════════════════════════════════════════════
// Dev server notes
// ───────────────────────────────────────────────────────────────
// • COOP / COEP headers: Google Identity Services opens a sign-in
//   popup that must `window.postMessage` back to this origin. The
//   browser blocks that unless we serve:
//
//       Cross-Origin-Opener-Policy: same-origin-allow-popups
//
//   COEP must NOT be `require-corp` here either, or third-party
//   resources (Google fonts, GSI client script) get blocked.
//
// • Proxy: /api/* and /socket.io/* are forwarded to the deployed
//   backend so contributors can run `npm run dev` without spinning
//   up the Node/Mongo/Redis stack locally. If you DO have the
//   backend running on :4000, set VITE_API_URL in your .env to
//   `http://localhost:4000/api/v1` and the proxy is bypassed.
// ═══════════════════════════════════════════════════════════════

const BACKEND = 'https://smart-id-backend.vercel.app'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            'Cross-Origin-Embedder-Policy': 'unsafe-none',
        },
        proxy: {
            '/api': {
                target: BACKEND,
                changeOrigin: true,
                secure: true,
            },
            '/socket.io': {
                target: BACKEND,
                changeOrigin: true,
                secure: true,
                ws: true,
            },
        },
    },
    preview: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            'Cross-Origin-Embedder-Policy': 'unsafe-none',
        },
    },
})
