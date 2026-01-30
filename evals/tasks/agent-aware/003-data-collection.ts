/**
 * 任务 003: 数据收集验证
 *
 * 难度: 中等
 * 评估: 服务器正确解析和处理 agent-aware 发送的数据
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '003-data-collection',
  name: '数据收集验证',
  description: '验证服务器能正确接收和解析 agent-aware 发送的行为数据',
  category: 'data',
  // 预先创建服务器文件
  setupScript: `
    cat > server.ts << 'EOF'
import http from 'node:http';

const server = http.createServer((req, res) => {
  // 设置 CORS 头
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
      try {
        const data = JSON.parse(body);
        console.log('收到数据:', data);
        // TODO: 需要添加数据验证和响应
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(4100, () => {
  console.log('行为数据服务器运行在 http://localhost:4100');
});
EOF
  `,
  userMessages: [
    '当前 server.ts 文件缺少完整的数据验证。请修改代码，添加以下功能：1) 验证请求数据包含 event_type 和 timestamp 字段 2) 如果缺少必填字段，返回 400 错误和详细错误信息 3) 在响应中返回接收到的数据字段',
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
      type: 'data-collection',
      port: 4100,
      endpoint: '/behaviors',
      testData: [
        {
          event_type: 'click',
          timestamp: 1706601600000,
          payload: { element: 'button#submit' },
        },
        {
          event_type: 'scroll',
          timestamp: 1706601601000,
          payload: { position: 500 },
        },
        {
          event_type: 'input',
          timestamp: 1706601602000,
          payload: { field: 'email', value: 'test@example.com' },
        },
      ],
      expectedFields: ['event_type', 'timestamp'],
    },
  ],
  timeout: 180000,
};
