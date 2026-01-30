/**
 * Vitest 测试初始化配置
 */

import { afterAll, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 测试临时目录前缀
const TEMP_DIR_PREFIX = '/tmp/agent-aware-eval';

/**
 * 清理测试临时目录
 */
function cleanupTempDirs() {
  try {
    const tmpDir = '/tmp';
    const entries = fs.readdirSync(tmpDir);

    for (const entry of entries) {
      if (entry.startsWith('agent-aware-eval')) {
        const fullPath = path.join(tmpDir, entry);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } catch {
          // 忽略删除失败
        }
      }
    }
  } catch {
    // 忽略错误
  }
}

// 测试前准备
beforeAll(() => {
  // 设置测试环境变量
  // NODE_ENV 在某些环境下是只读的，使用 Object.defineProperty
  if (process.env.NODE_ENV !== 'test') {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: true,
      configurable: true,
    });
  }
});

// 测试后清理
afterAll(() => {
  // 清理临时目录
  cleanupTempDirs();
});
