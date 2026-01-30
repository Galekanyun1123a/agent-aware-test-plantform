/**
 * 评估任务 008: 运行时测试
 *
 * 测试浏览器自动化评分器
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '008-runtime-test',
  name: '运行时页面测试',
  description: `测试浏览器自动化评分器功能。

任务：验证工作区项目能正确启动并在浏览器中显示。`,
  category: 'runtime',
  userMessages: [
    '请确保项目可以正常运行，不需要修改任何代码。',
  ],
  graders: [
    {
      type: 'runtime',
      port: 5173,
      timeout: 30000,
      expectText: 'vite',
      startCommand: 'pnpm dev',
    },
  ],
  timeout: 120000,
};
