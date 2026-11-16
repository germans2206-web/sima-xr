// Desktop-only preview over plain HTTP on localhost (a secure context, so the
// WebXR emulator still works). Use vite.config.ts (HTTPS) for headset testing.
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(
  { ...base, plugins: [] },
  defineConfig({
    plugins: [iwsdkDev({ https: false })],
    server: { host: 'localhost', port: 8082 },
  }),
);
