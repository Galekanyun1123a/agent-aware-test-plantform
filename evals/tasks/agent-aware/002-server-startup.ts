/**
 * 任务 002: Agent-Aware 服务器启动
 *
 * 难度: 简单
 * 评估: 在 package.json 中配置并启动 @reskill/agent-aware-server
 *
 * @reskill/agent-aware-server 是预装的服务端组件，用于接收客户端上报的用户行为数据。
 * 默认监听 4100 端口，提供 POST /behaviors 端点。
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '002-server-startup',
  name: 'Agent-Aware 服务器启动',
  description: '配置并启动 @reskill/agent-aware-server 行为数据收集服务',
  category: 'server',
  templateId: 'node-server',
  // agent-aware-server 只支持固定端口 4100，不进行端口重写
  useFixedPort: true,
  userMessages: [
    '项目中已预装 @reskill/agent-aware-server。请在 package.json 的 scripts 中添加 "agent-server": "agent-aware-server" 脚本，用于启动行为数据收集服务。该服务默认监听 4100 端口。',
  ],
  graders: [
    {
      type: 'code',
      checks: {
        fileExists: ['package.json'],
        fileContains: [
          {
            file: 'package.json',
            // 检查是否添加了 agent-aware-server 启动脚本
            pattern: 'agent-aware-server',
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
      // 使用 agent-aware-server CLI
      startCommand: 'npx agent-aware-server',
    },
  ],
  timeout: 120000,
};
