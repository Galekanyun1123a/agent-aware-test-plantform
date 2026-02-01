/**
 * 任务 001: Agent-Aware 集成
 *
 * 难度: 简单
 * 评估: @reskill/agent-aware 库的正确集成
 *
 * 对应 getSystemPrompt 中描述的必须集成要求：
 * 1. 安装 @reskill/agent-aware 依赖
 * 2. 在 src/main.tsx 中初始化 initAgentAware()
 * 3. 在 React 渲染之前初始化
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '001-integration',
  name: 'Agent-Aware 集成',
  description: '在 Vite + React + TypeScript 项目中正确集成 @reskill/agent-aware 库，确保在 React 渲染之前初始化用户行为追踪',
  category: 'integration',
  userMessages: [
    '请确保项目已正确集成 @reskill/agent-aware 库。要求：1) 在 package.json 中添加 @reskill/agent-aware 依赖 2) 在 src/main.tsx 中导入 initAgentAware 3) 在 React 渲染之前调用 initAgentAware() 进行初始化',
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
        fileExists: ['src/main.tsx', 'package.json', 'src/App.tsx'],
        fileContains: [
          {
            file: 'package.json',
            pattern: '@reskill/agent-aware',
          },
          {
            file: 'src/main.tsx',
            pattern: 'initAgentAware',
          },
          {
            file: 'src/main.tsx',
            // 确保在 createRoot 之前调用
            pattern: 'initAgentAware\\(\\)[\\s\\S]*createRoot',
          },
        ],
      },
    },
    {
      type: 'llm',
      rubric: 'agent-aware-integration.md',
      dimensions: ['依赖管理', '初始化配置', '代码质量', '初始化顺序'],
      threshold: 0.7,
    },
  ],
  timeout: 180000, // 3 分钟
};
