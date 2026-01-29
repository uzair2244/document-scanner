import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This config is for building the demo/web app for deployment (e.g., Vercel)
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        open: true,
    },
    define: {
        'process.env': '{}',
        global: 'globalThis'
    },
    build: {
        outDir: 'dist-demo',
        // No lib mode - builds as a regular web app
    }
});
