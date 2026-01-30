import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 评估测试配置
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],

    // 仅包含 evals 测试文件
    include: ['evals/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'workspace'],

    // 评估测试需要较长超时（涉及 AI 交互）
    testTimeout: 600000, // 10 分钟

    // 评估测试串行执行，避免资源竞争
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Vitest reporter
    reporters: process.env.CI ? 'verbose' : 'default',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
