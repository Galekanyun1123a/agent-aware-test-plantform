/**
 * 任务 003: Agent-Aware 数据收集验证
 *
 * 难度: 简单
 * 评估: 验证 @reskill/agent-aware-server 能正确接收行为数据
 *
 * 使用预装的 agent-aware-server，测试数据收集功能。
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '003-data-collection',
  name: 'Agent-Aware 数据收集验证',
  description: '验证 @reskill/agent-aware-server 能正确接收和处理行为数据',
  category: 'data',
  templateId: 'node-server',
  // agent-aware-server 只支持固定端口 4100
  useFixedPort: true,
  userMessages: [
    '请启动 @reskill/agent-aware-server 服务（使用 npx agent-aware-server），然后创建一个测试脚本 test-collect.js，向 http://localhost:4100/behaviors 发送测试数据，验证服务是否正常工作。测试数据应包含 event_type 和 timestamp 字段。',
  ],
  graders: [
    {
      type: 'code',
      checks: {
        fileExists: ['test-collect.js'],
        fileContains: [
          {
            file: 'test-collect.js',
            pattern: '(fetch|http\\.request|axios)',
          },
          {
            file: 'test-collect.js',
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
      startCommand: 'npx agent-aware-server',
    },
    {
      type: 'data-collection',
      port: 4100,
      endpoint: '/behaviors',
      testData: [
        {
          event_type: 'click',
          timestamp: 1706601600000,
          payload: { element: 'button#submit' },
        },
        {
          event_type: 'scroll',
          timestamp: 1706601601000,
          payload: { position: 500 },
        },
      ],
      expectedFields: ['event_type', 'timestamp'],
    },
  ],
  timeout: 120000,
};
