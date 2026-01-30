/**
 * 任务 005: 跨对话上下文复用
 *
 * 难度: 中等
 * 评估: 验证存储的数据可以在后续对话中使用
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '005-context-reuse',
  name: '跨对话上下文复用',
  description: '验证已存储的行为数据可以被正确读取和分析',
  category: 'context',
  // 预先创建包含测试数据的文件
  setupScript: `
    mkdir -p data
    cat > data/behaviors.json << 'EOF'
[
  {"event_type": "click", "timestamp": 1706601600000, "payload": {"element": "button#submit"}},
  {"event_type": "scroll", "timestamp": 1706601601000, "payload": {"position": 500}},
  {"event_type": "click", "timestamp": 1706601602000, "payload": {"element": "a.link"}},
  {"event_type": "input", "timestamp": 1706601603000, "payload": {"field": "email"}},
  {"event_type": "click", "timestamp": 1706601604000, "payload": {"element": "button#cancel"}},
  {"event_type": "scroll", "timestamp": 1706601605000, "payload": {"position": 1000}},
  {"event_type": "click", "timestamp": 1706601606000, "payload": {"element": "div.modal"}}
]
EOF
  `,
  userMessages: [
    '请读取 data/behaviors.json 文件，告诉我：1) 文件中总共有多少条记录？2) 最常见的 event_type 是什么？出现了几次？',
    '基于这些数据，请分析用户的行为模式，哪个 element 被点击次数最多？',
  ],
  graders: [
    {
      type: 'context',
      expectedAnswer: /7|七|click|点击|4|四次/i,
      responseIndex: 0,
    },
    {
      type: 'context',
      expectedAnswer: /click|button|submit|点击/i,
      responseIndex: 1,
    },
    {
      type: 'llm',
      rubric: 'data-handling.md',
      dimensions: ['数据读取', '分析准确性', '响应清晰度'],
      threshold: 0.6,
    },
  ],
  timeout: 120000,
};
