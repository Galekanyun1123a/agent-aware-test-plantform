/**
 * 任务 006: AI 主动检测能力
 *
 * 难度: 较难
 * 评估: AI 能主动发现数据问题并提出修复方案
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '006-ai-detection',
  name: 'AI 主动检测能力',
  description: '验证 AI 能主动检测数据中的问题并提出修复方案',
  category: 'ai-detection',
  // 创建包含各种问题的数据文件
  setupScript: `
    mkdir -p data
    cat > data/behaviors.json << 'EOF'
[
  {"event_type": "click", "timestamp": 1706601600000, "payload": {"element": "button"}},
  {"event_type": "scroll"},
  {"timestamp": "not-a-number", "payload": {}},
  {"event_type": null, "timestamp": 1706601602000},
  {"event_type": "", "timestamp": 1706601603000},
  {"event_type": "input", "timestamp": 1706601604000, "payload": {"field": "name"}},
  {"event_type": "click", "timestamp": -1},
  {"random_field": "some_value"}
]
EOF
  `,
  userMessages: [
    '请检查 data/behaviors.json 文件的数据健康状况。识别所有数据质量问题，并说明每个问题的具体位置和原因。然后提供修复后的数据，保存为 data/behaviors-fixed.json。',
  ],
  graders: [
    {
      type: 'detection',
      issues: [
        'missing_timestamp',
        'invalid_timestamp',
        'null_event_type',
        'empty_event_type',
        'missing_event_type',
      ],
      fixedFilePath: 'data/behaviors-fixed.json',
    },
    {
      type: 'storage',
      filePath: 'data/behaviors-fixed.json',
      minRecords: 2,
      expectedFields: ['event_type', 'timestamp'],
    },
    {
      type: 'llm',
      rubric: 'error-recovery.md',
      dimensions: ['问题识别', '修复方案', '数据完整性'],
      threshold: 0.6,
    },
  ],
  timeout: 180000,
};
