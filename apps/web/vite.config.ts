import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { createMockReviewApiPlugin } from './mock-review-api.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMockApi = env.KAGURA_WEB_MOCK_API === 'true';

  return {
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      vanillaExtractPlugin(),
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
