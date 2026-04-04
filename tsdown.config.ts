import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  platform: 'node',
  format: 'esm',
  clean: true,
  tsconfig: 'tsconfig.json',
  fixedExtension: false,
});
