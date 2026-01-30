/**
 * 任务 002: 行为数据服务器启动
 *
 * 难度: 中等
 * 评估: 创建并启动 4100 端口的行为数据收集服务器
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '002-server-startup',
  name: '行为服务器启动',
  description: '创建一个 HTTP 服务器，监听 4100 端口，用于接收用户行为数据',
  category: 'server',
  userMessages: [
    '请创建一个 Node.js HTTP 服务器（使用 TypeScript），要求：1) 监听 4100 端口 2) 提供 POST /behaviors 端点 3) 接收 JSON 格式的请求体 4) 返回 200 状态码表示接收成功。请将代码保存为 server.ts 文件。',
  ],
  graders: [
    {
      type: 'code',
      checks: {
        fileExists: ['server.ts'],
        fileContains: [
          {
            file: 'server.ts',
            pattern: '4100',
          },
          {
            file: 'server.ts',
            pattern: '/behaviors',
          },
        ],
      },
    },
    {
      type: 'server',
      port: 4100,
      endpoint: '/behaviors',
      method: 'POST',
      timeout: 30000,
      startCommand: 'npx tsx server.ts',
    },
  ],
  timeout: 180000,
};
