import pandacss from '@pandacss/dev/postcss';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import { defineConfig, loadEnv } from 'vite';

import { createMockReviewApiPlugin } from './mock-review-api.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMockApi = env.KAGURA_WEB_MOCK_API === 'true';

  return {
    css: {
      postcss: {
        plugins: [pandacss() as never, autoprefixer() as never],
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      codeInspectorPlugin({
        bundler: 'vite',
        hotKeys: ['altKey'],
      }),
      react(),
      ...(useMockApi ? [createMockReviewApiPlugin()] : []),
    ],
    server: {
      ...(!useMockApi
        ? {
            proxy: {
              '/api': env.KAGURA_REVIEW_PANEL_API_URL ?? 'http://127.0.0.1:3077',
            },
          }
        : {}),
    },
  };
});
