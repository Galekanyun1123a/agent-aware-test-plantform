/**
 * 任务 001: Agent-Aware 集成
 *
 * 难度: 简单
 * 评估: @reskill/agent-aware 库的正确集成
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '001-integration',
  name: 'Agent-Aware 集成',
  description: '在项目中正确集成 @reskill/agent-aware 库，确保依赖安装和初始化配置正确',
  category: 'integration',
  userMessages: [
    '请在项目中集成 @reskill/agent-aware 库。要求：1) 在 package.json 中添加依赖 2) 在 src/main.tsx 中导入并调用 initAgentAware() 3)',
  ],
  graders: [
    {
      type: 'dependency',
      checks: {
        packageName: '@reskill/agent-aware',
        importCheck: "import.*\\{.*initAgentAware.*\\}.*from.*['\"]@reskill/agent-aware['\"]",
        initCheck: 'initAgentAware\\s*\\(',
        targetFile: 'src/main.tsx',
      },
    },
    {
      type: 'code',
      checks: {
        fileExists: ['src/main.tsx', 'package.json'],
        fileContains: [
          {
            file: 'package.json',
            pattern: '@reskill/agent-aware',
          },
          {
            file: 'src/main.tsx',
            pattern: 'initAgentAware',
          },
        ],
      },
    },
    {
      type: 'llm',
      rubric: 'agent-aware-integration.md',
      dimensions: ['依赖管理', '初始化配置', '代码质量'],
      threshold: 0.7,
    },
  ],
  timeout: 180000, // 3 分钟
};
