/**
 * 任务 010: Agent-Aware 错误检测响应
 *
 * 难度: 较难
 * 评估: AI 能主动读取 .agent-aware/error.json 并修复运行时错误
 *
 * 对应 getSystemPrompt 中描述的：
 * - AlertDetector 检测器
 * - 运行时错误检测
 * - Promise 异常检测
 * - Console 错误检测
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '010-error-detection',
  name: 'Agent-Aware 错误检测响应',
  description: 'AI 主动检测 .agent-aware/error.json 中的运行时错误并修复代码',
  category: 'agent-aware-detection',
  templateId: 'vite-react',
  // 模拟 agent-aware 检测到的运行时错误，同时创建包含错误的代码
  setupScript: `
    mkdir -p .agent-aware
    mkdir -p src
    
    # 创建包含错误的 App.tsx
    cat > src/App.tsx << 'EOF'
import { useState } from 'react'

function App() {
  const [data, setData] = useState(null)

  // 错误：访问 null 的属性
  const userName = data.user.name

  // 错误：未定义的函数调用
  const result = processData(data)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold">{userName}</h1>
      <p>{result}</p>
    </div>
  )
}

export default App
EOF

    # 创建错误检测文件
    cat > .agent-aware/error.json << 'EOF'
{
  "timestamp": "${new Date().toISOString()}",
  "severity": "critical",
  "type": "error",
  "summary": "检测到 3 个运行时错误",
  "details": {
    "totalErrors": 3,
    "recentErrors": [
      {
        "message": "Cannot read property 'user' of null",
        "type": "runtime",
        "stack": "TypeError: Cannot read property 'user' of null\\n    at App (src/App.tsx:7:24)",
        "timestamp": "${new Date().toISOString()}"
      },
      {
        "message": "processData is not defined",
        "type": "runtime",
        "stack": "ReferenceError: processData is not defined\\n    at App (src/App.tsx:10:18)",
        "timestamp": "${new Date().toISOString()}"
      },
      {
        "message": "Rendered more hooks than during the previous render",
        "type": "runtime",
        "stack": "Error: Rendered more hooks than during the previous render\\n    at App (src/App.tsx:5:1)",
        "timestamp": "${new Date().toISOString()}"
      }
    ]
  }
}
EOF
  `,
  userMessages: [
    '请检查 .agent-aware/error.json 文件，查看检测到的运行时错误。根据错误信息定位并修复 src/App.tsx 中的问题。',
  ],
  graders: [
    {
      type: 'alert',
      checks: {
        fileExists: true,
        minErrorCount: 1,
        errorTypes: ['runtime'],
        errorMessageContains: ['Cannot read property', 'not defined'],
      },
    },
    {
      type: 'code',
      checks: {
        fileExists: ['src/App.tsx'],
        fileContains: [
          {
            file: 'src/App.tsx',
            // 检查是否添加了空值检查
            pattern: '(\\?\\.|\\?\\?|!==\\s*null|!=\\s*null|if\\s*\\()',
          },
        ],
      },
    },
    {
      type: 'llm',
      rubric: 'error-recovery.md',
      dimensions: ['错误识别', '修复方案', '代码质量'],
      threshold: 0.6,
    },
  ],
  timeout: 180000,
};
