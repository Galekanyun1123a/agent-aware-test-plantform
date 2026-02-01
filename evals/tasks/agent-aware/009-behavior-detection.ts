/**
 * 任务 009: Agent-Aware 行为检测响应
 *
 * 难度: 较难
 * 评估: AI 能主动读取 .agent-aware/behavior.json 并响应用户行为问题
 *
 * 对应 getSystemPrompt 中描述的：
 * - BehaviorDetector 检测器
 * - 挫折检测（frustration）
 * - 愤怒点击检测（rage click）
 * - 死点击检测（dead click）
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '009-behavior-detection',
  name: 'Agent-Aware 行为检测响应',
  description: 'AI 主动检测 .agent-aware/behavior.json 中的用户行为问题并提出修复方案',
  category: 'agent-aware-detection',
  templateId: 'vite-react',
  // 模拟 agent-aware 检测到的用户挫折行为
  setupScript: `
    mkdir -p .agent-aware
    cat > .agent-aware/behavior.json << 'EOF'
{
  "timestamp": "${new Date().toISOString()}",
  "severity": "critical",
  "type": "frustration",
  "summary": "检测到用户挫折行为（挫折指数: 85）",
  "details": {
    "frustrationScore": 85,
    "rageClickCount": 7,
    "deadClickCount": 4,
    "totalInteractions": 20,
    "recentActions": [
      {"type": "rage_click", "target": "button.submit", "count": 5, "timestamp": "${Date.now() - 5000}"},
      {"type": "dead_click", "target": "div.disabled-area", "count": 3, "timestamp": "${Date.now() - 3000}"},
      {"type": "rage_click", "target": "a.broken-link", "count": 2, "timestamp": "${Date.now() - 1000}"}
    ],
    "possibleCauses": [
      "提交按钮无响应",
      "链接不可点击",
      "页面加载缓慢"
    ]
  }
}
EOF
  `,
  userMessages: [
    '请检查 .agent-aware/ 目录下的检测文件，了解用户在使用页面时遇到的问题。根据检测结果，分析问题原因并提出修复方案。',
  ],
  graders: [
    {
      type: 'behavior',
      checks: {
        frustration: true,
        rageClick: true,
        deadClick: true,
        aiResponse: true,
      },
      expectedSeverity: 'critical',
    },
    {
      type: 'context',
      expectedAnswer: /(挫折|愤怒点击|死点击|rage.*click|dead.*click|frustration)/i,
      responseIndex: 0,
    },
    {
      type: 'llm',
      rubric: 'behavior-detection.md',
      dimensions: ['问题识别能力', '原因分析能力', '修复方案质量', '主动响应程度'],
      threshold: 0.6,
    },
  ],
  timeout: 180000,
};
