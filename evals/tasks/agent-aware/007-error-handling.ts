/**
 * 任务 007: 错误数据处理能力
 *
 * 难度: 较难
 * 评估: 服务器能正确处理各种错误情况
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '007-error-handling',
  name: '错误数据处理能力',
  description: '验证服务器能正确处理各种异常请求',
  category: 'error-handling',
  // 创建基础服务器（需要完善错误处理）
  setupScript: `
    mkdir -p data
    cat > server.ts << 'EOF'
import http from 'node:http';
import fs from 'node:fs';

const DATA_FILE = 'data/behaviors.json';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/behaviors') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // TODO: 需要添加完整的错误处理
      // 1. JSON 解析失败
      // 2. 数据字段缺失
      // 3. 数据类型错误
      // 4. 超大请求体
      const data = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(4100, () => {
  console.log('服务器运行在 http://localhost:4100');
});
EOF
  `,
  userMessages: [
    '请优化 server.ts 的错误处理能力，确保能正确处理以下异常情况：1) 无效 JSON（返回 400 和错误信息）2) 缺少必填字段 event_type 或 timestamp（返回 400）3) timestamp 不是有效数字（返回 400）4) 请求体超过 1MB（返回 413）。每种错误都要返回清晰的错误信息。',
  ],
  graders: [
    {
      type: 'server',
      port: 4100,
      endpoint: '/behaviors',
      method: 'POST',
      timeout: 30000,
      startCommand: 'npx tsx server.ts',
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
          name: '缺少 event_type',
          request: {
            body: { timestamp: 1706601600000 },
          },
          expectStatus: 400,
        },
        {
          name: '缺少 timestamp',
          request: {
            body: { event_type: 'click' },
          },
          expectStatus: 400,
        },
        {
          name: '无效 timestamp 类型',
          request: {
            body: { event_type: 'click', timestamp: 'not-a-number' },
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
      type: 'code',
      checks: {
        fileContains: [
          {
            file: 'server.ts',
            pattern: 'try.*catch|JSON\\.parse',
          },
          {
            file: 'server.ts',
            pattern: '400|413|error',
          },
        ],
      },
    },
    {
      type: 'llm',
      rubric: 'error-recovery.md',
      dimensions: ['错误处理覆盖度', '错误信息质量', '代码健壮性'],
      threshold: 0.7,
    },
  ],
  timeout: 180000,
};
