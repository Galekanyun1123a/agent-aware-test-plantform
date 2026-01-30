/**
 * 任务 004: 文件持久化存储
 *
 * 难度: 中等
 * 评估: 将收集的行为数据持久化存储到文件中
 */

import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '004-file-storage',
  name: '文件持久化存储',
  description: '将收集到的行为数据持久化存储到 JSON 文件中',
  category: 'storage',
  // 预先创建基础服务器
  setupScript: `
    mkdir -p data
    cat > server.ts << 'EOF'
import http from 'node:http';

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
      try {
        const data = JSON.parse(body);
        // TODO: 将数据保存到 data/behaviors.json 文件
        // 要求：追加存储，而非覆盖
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
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
    '请修改 server.ts，实现数据持久化功能：1) 将收到的行为数据追加存储到 data/behaviors.json 文件 2) 如果文件不存在则创建 3) 使用 JSON 数组格式存储多条记录 4) 每次追加新数据而不是覆盖',
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
      type: 'storage',
      filePath: 'data/behaviors.json',
      minRecords: 1,
      expectedFields: ['event_type', 'timestamp'],
    },
    {
      type: 'code',
      checks: {
        fileContains: [
          {
            file: 'server.ts',
            pattern: 'writeFile|appendFile|fs\\.',
          },
          {
            file: 'server.ts',
            pattern: 'data/behaviors\\.json|behaviors\\.json',
          },
        ],
      },
    },
  ],
  timeout: 180000,
};
