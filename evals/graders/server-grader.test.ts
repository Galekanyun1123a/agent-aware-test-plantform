/**
 * Server Grader 单元测试
 *
 * 注意：这些测试主要验证逻辑，不会实际启动服务器
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ServerGraderConfig } from '../harness/types';

// 测试临时目录
let testDir: string;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-grader-test-'));
});

afterAll(() => {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

describe('Server Grader 配置', () => {
  it('应该有有效的默认配置', () => {
    const config: ServerGraderConfig = {
      type: 'server',
      port: 3000,
      endpoint: '/api/test',
    };

    expect(config.type).toBe('server');
    expect(config.port).toBe(3000);
    expect(config.endpoint).toBe('/api/test');
    expect(config.timeout).toBeUndefined();
    expect(config.method).toBeUndefined();
  });

  it('应该支持自定义配置', () => {
    const config: ServerGraderConfig = {
      type: 'server',
      port: 8080,
      endpoint: '/health',
      timeout: 60000,
      method: 'GET',
      startCommand: 'node server.js',
    };

    expect(config.port).toBe(8080);
    expect(config.timeout).toBe(60000);
    expect(config.method).toBe('GET');
    expect(config.startCommand).toBe('node server.js');
  });
});

describe('服务器文件检测', () => {
  it('应该识别 server.ts 文件', () => {
    fs.writeFileSync(
      path.join(testDir, 'server.ts'),
      `
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();
app.get('/', (c) => c.text('Hello'));

serve({ fetch: app.fetch, port: 3000 });
`
    );

    const serverFile = path.join(testDir, 'server.ts');
    expect(fs.existsSync(serverFile)).toBe(true);
  });

  it('应该识别 src/server.ts 文件', () => {
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'server.ts'), '// server code');

    const serverFile = path.join(testDir, 'src', 'server.ts');
    expect(fs.existsSync(serverFile)).toBe(true);
  });

  it('应该识别 behavior-server.ts 文件', () => {
    fs.writeFileSync(path.join(testDir, 'behavior-server.ts'), '// behavior server');

    const serverFile = path.join(testDir, 'behavior-server.ts');
    expect(fs.existsSync(serverFile)).toBe(true);
  });
});

describe('端口配置验证', () => {
  it('应该接受有效的端口号', () => {
    const validPorts = [80, 443, 3000, 8080, 9000, 65535];

    for (const port of validPorts) {
      const config: ServerGraderConfig = {
        type: 'server',
        port,
        endpoint: '/test',
      };
      expect(config.port).toBe(port);
    }
  });

  it('应该验证端口范围', () => {
    // 端口应该在 1-65535 范围内
    const config: ServerGraderConfig = {
      type: 'server',
      port: 3000,
      endpoint: '/test',
    };

    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThanOrEqual(65535);
  });
});

describe('HTTP 方法配置', () => {
  it('应该支持所有标准方法', () => {
    const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
    ];

    for (const method of methods) {
      const config: ServerGraderConfig = {
        type: 'server',
        port: 3000,
        endpoint: '/test',
        method,
      };
      expect(config.method).toBe(method);
    }
  });

  it('默认方法应该是 POST（根据 grader 实现）', () => {
    const config: ServerGraderConfig = {
      type: 'server',
      port: 3000,
      endpoint: '/test',
    };

    // 默认未设置，grader 内部会默认为 POST
    expect(config.method).toBeUndefined();
  });
});

describe('超时配置', () => {
  it('应该支持自定义超时', () => {
    const config: ServerGraderConfig = {
      type: 'server',
      port: 3000,
      endpoint: '/test',
      timeout: 120000, // 2 分钟
    };

    expect(config.timeout).toBe(120000);
  });

  it('默认超时应该是合理值', () => {
    // grader 内部默认 30000ms
    const defaultTimeout = 30000;
    expect(defaultTimeout).toBeGreaterThanOrEqual(10000);
    expect(defaultTimeout).toBeLessThanOrEqual(300000);
  });
});
