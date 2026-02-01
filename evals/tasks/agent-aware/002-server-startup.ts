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
  description: '创建一个 HTTP 服务器，用于接收用户行为数据',
  category: 'server',
  templateId: 'node-server',
  userMessages: [
    '请修改 src/server.js 文件（或创建 src/server.ts），实现一个 Node.js HTTP 服务器，要求：1) 从环境变量 PORT 获取监听端口 2) 提供 POST /behaviors 端点 3) 接收 JSON 格式的请求体 4) 返回 200 状态码和 JSON 响应表示接收成功。',
  ],
  graders: [
    {
      type: 'code',
      checks: {
        // 接受两种路径
        fileExists: ['src/server.js'],
        fileContains: [
          {
            file: 'src/server.js',
            // 检查是否有 /behaviors 端点
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
      // 使用模板自带的启动命令
      startCommand: 'node src/server.js',
    },
  ],
  timeout: 180000,
};
