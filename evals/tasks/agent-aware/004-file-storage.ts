/**
 * 任务 004: Agent-Aware 数据存储验证
 *
 * 难度: 简单
 * 评估: 验证 @reskill/agent-aware-server 的数据存储功能
 *
 * agent-aware-server 会自动将收集的数据存储到 data/ 目录。
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '004-file-storage',
  name: 'Agent-Aware 数据存储验证',
  description: '验证 @reskill/agent-aware-server 能正确存储行为数据到文件',
  category: 'storage',
  templateId: 'node-server',
  // agent-aware-server 只支持固定端口 4100
  useFixedPort: true,
  userMessages: [
    '请启动 @reskill/agent-aware-server 服务，然后向 http://localhost:4100/behaviors 发送几条测试数据。发送后检查 data/ 目录，确认数据是否被正确存储。请创建一个 send-data.js 脚本来发送测试数据。',
  ],
  graders: [
    {
      type: 'code',
      checks: {
        fileExists: ['send-data.js'],
        fileContains: [
          {
            file: 'send-data.js',
            pattern: '(fetch|http\\.request|axios)',
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
      type: 'storage',
      filePath: 'data/behaviors.json',
      minRecords: 1,
      expectedFields: ['event_type', 'timestamp'],
    },
  ],
  timeout: 120000,
};
