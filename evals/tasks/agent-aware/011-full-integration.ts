/**
 * 任务 011: 完整 Agent-Aware 集成测试
 *
 * 难度: 困难
 * 评估: 完整测试 AI 创建页面并正确集成 agent-aware 的能力
 *
 * 对应 getSystemPrompt 中描述的完整工作流程：
 * 1. 在 Vite + React + TypeScript 项目中工作
 * 2. 正确集成 @reskill/agent-aware
 * 3. 使用 Tailwind CSS 样式
 * 4. 使用 lucide-react 图标
 * 5. 遵守文件修改规范
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '011-full-integration',
  name: '完整 Agent-Aware 集成测试',
  description: '测试 AI 创建页面并正确集成 agent-aware 的完整能力',
  category: 'integration',
  userMessages: [
    '请创建一个用户登录页面。要求：1) 包含用户名和密码输入框 2) 有登录按钮 3) 使用 Tailwind CSS 样式美化 4) 使用 lucide-react 图标 5) 确保 agent-aware 已正确初始化',
  ],
  graders: [
    // 检查依赖集成
    {
      type: 'dependency',
      checks: {
        packageName: '@reskill/agent-aware',
        importCheck: "import.*\\{.*initAgentAware.*\\}.*from.*['\"]@reskill/agent-aware['\"]",
        initCheck: 'initAgentAware\\s*\\(',
        targetFile: 'src/main.tsx',
      },
    },
    // 检查文件存在和内容
    {
      type: 'code',
      checks: {
        fileExists: ['src/App.tsx', 'src/main.tsx', 'src/index.css'],
        fileContains: [
          {
            file: 'src/App.tsx',
            // 检查是否有输入框
            pattern: '(input|Input)',
          },
          {
            file: 'src/App.tsx',
            // 检查是否使用了 Tailwind 类名
            pattern: 'className\\s*=',
          },
          {
            file: 'src/App.tsx',
            // 检查是否导入了 lucide-react
            pattern: "(from.*['\"]lucide-react['\"]|lucide)",
          },
        ],
      },
    },
    // 运行时测试
    {
      type: 'runtime',
      port: 5173,
      timeout: 30000,
      // 检查页面是否包含登录相关元素
      expectText: ['登录', '用户名', '密码'],
      expectSelector: ['input', 'button'],
      startCommand: 'pnpm dev',
    },
    // LLM 评分
    {
      type: 'llm',
      rubric: 'agent-aware-integration.md',
      dimensions: ['依赖管理', 'UI 实现', '代码质量', 'Agent-Aware 集成'],
      threshold: 0.7,
    },
  ],
  timeout: 300000, // 5 分钟
};
