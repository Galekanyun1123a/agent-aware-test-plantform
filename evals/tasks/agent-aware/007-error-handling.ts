/**
 * 任务 007: Agent-Aware 服务错误处理测试
 *
 * 难度: 中等
 * 评估: 测试 @reskill/agent-aware-server 对各种异常请求的处理能力
 *
 * 测试服务器对无效数据的响应。
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '007-error-handling',
  name: 'Agent-Aware 服务错误处理测试',
  description: '测试 @reskill/agent-aware-server 对异常请求的处理能力',
  category: 'error-handling',
  templateId: 'node-server',
  // agent-aware-server 只支持固定端口 4100
  useFixedPort: true,
  userMessages: [
    '请创建一个测试脚本 test-errors.js，测试 @reskill/agent-aware-server 的错误处理能力。测试以下场景：1) 发送无效 JSON 2) 发送缺少必填字段的数据 3) 发送正常数据。记录每种情况的响应状态码和错误信息。',
  ],
  graders: [
    {
      type: 'code',
      checks: {
        fileExists: ['test-errors.js'],
        fileContains: [
          {
            file: 'test-errors.js',
            pattern: '(fetch|http\\.request|axios)',
          },
          {
            file: 'test-errors.js',
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
      type: 'error-handle',
      port: 4100,
      endpoint: '/behaviors',
      errorCases: [
        {
          name: '无效 JSON',
          request: {
            body: 'not valid json {{{',
            contentType: 'application/json',
          },
          expectStatus: 400,
        },
        {
          name: '正常请求',
          request: {
            body: { event_type: 'click', timestamp: 1706601600000 },
          },
          expectStatus: 200,
        },
      ],
    },
    {
      type: 'llm',
      rubric: 'error-recovery.md',
      dimensions: ['测试覆盖度', '错误理解能力', '代码质量'],
      threshold: 0.6,
    },
  ],
  timeout: 120000,
};
