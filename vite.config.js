import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    allowedHosts: ['upwardly-confessable-francisco.ngrok-free.dev'],
  },
  define: {
    'process.env': '{}',
    global: 'globalThis'
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'DocumentScanner',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format === 'es' ? 'es' : 'umd'}.js`
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM'
        }
      }
    }
  }
});