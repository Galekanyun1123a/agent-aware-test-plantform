import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 单元测试配置
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/workspace/**',
      // 排除 evals 测试（使用单独配置运行）
      'evals/**/*.test.ts',
    ],

    // 测试超时：30秒
    testTimeout: 30000,

    // 使用 threads pool（单元测试默认）
    pool: process.env.CI ? undefined : 'threads',

    // Vitest reporter
    reporters: process.env.CI ? 'verbose' : 'default',

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'workspace/',
        '**/*.d.ts',
        '**/*.config.*',
        'evals/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
