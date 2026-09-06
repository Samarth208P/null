import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const rootEnvironmentDirectory = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  plugins: [react()],
  envDir: rootEnvironmentDirectory,
  envPrefix: 'VITE_',
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173, strictPort: true,
    fs: { strict: true, deny: ['**/.env', '**/.env.*', '**/.artifacts/**', '**/.research/**', '**/*.{crt,pem}', '**/.git/**'] },
  },
});
