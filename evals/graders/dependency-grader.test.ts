/**
 * Dependency Grader 单元测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gradeDependency } from './dependency-grader';
import type { DependencyGraderConfig } from '../harness/types';

// 测试临时目录
let testDir: string;

beforeAll(() => {
  // 创建测试目录
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-grader-test-'));
});

afterAll(() => {
  // 清理测试目录
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

describe('gradeDependency', () => {
  describe('package.json 检查', () => {
    it('应该检测到存在的依赖', async () => {
      // 创建 package.json
      const packageJson = {
        name: 'test',
        dependencies: {
          react: '^18.0.0',
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // 创建假的 node_modules
      const nodeModulesPath = path.join(testDir, 'node_modules', 'react');
      fs.mkdirSync(nodeModulesPath, { recursive: true });
      fs.writeFileSync(
        path.join(nodeModulesPath, 'package.json'),
        JSON.stringify({ name: 'react', version: '18.0.0' })
      );

      const config: DependencyGraderConfig = {
        type: 'dependency',
        checks: {
          packageName: 'react',
        },
      };

      const result = await gradeDependency(testDir, config);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(1);
      expect(result.details.packageJson).toBe(true);
      expect(result.details.nodeModules).toBe(true);
    });

    it('应该检测到不存在的依赖', async () => {
      // 创建空的 package.json
      const packageJson = {
        name: 'test',
        dependencies: {},
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const config: DependencyGraderConfig = {
        type: 'dependency',
        checks: {
          packageName: 'nonexistent-package',
        },
      };

      const result = await gradeDependency(testDir, config);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(1);
      expect(result.details.packageJson).toBe(false);
    });

    it('应该在 package.json 不存在时返回失败', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));

      const config: DependencyGraderConfig = {
        type: 'dependency',
        checks: {
          packageName: 'react',
        },
      };

      const result = await gradeDependency(emptyDir, config);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('package.json');

      // 清理
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('导入检查', () => {
    it('应该检测到正确的导入语句', async () => {
      // 创建测试文件
      const srcDir = path.join(testDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'main.tsx'),
        `import React from 'react';
import { useState } from 'react';

export function App() {
  return <div>Hello</div>;
}
`
      );

      // 创建 package.json 和 node_modules
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: { react: '^18.0.0' } })
      );
      const nodeModulesPath = path.join(testDir, 'node_modules', 'react');
      fs.mkdirSync(nodeModulesPath, { recursive: true });
      fs.writeFileSync(
        path.join(nodeModulesPath, 'package.json'),
        JSON.stringify({ name: 'react' })
      );

      const config: DependencyGraderConfig = {
        type: 'dependency',
        checks: {
          packageName: 'react',
          importCheck: "import.*from\\s+['\"]react['\"]",
          targetFile: 'src/main.tsx',
        },
      };

      const result = await gradeDependency(testDir, config);

      expect(result.details.importCheck).toBe(true);
    });

    it('应该检测到缺失的导入语句', async () => {
      const srcDir = path.join(testDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(
        path.join(srcDir, 'main.tsx'),
        `// No imports
export function App() {
  return null;
}
`
      );

      const config: DependencyGraderConfig = {
        type: 'dependency',
        checks: {
          packageName: 'react',
          importCheck: "import.*from\\s+['\"]react['\"]",
          targetFile: 'src/main.tsx',
        },
      };

      const result = await gradeDependency(testDir, config);

      expect(result.details.importCheck).toBe(false);
    });
  });

  describe('devDependencies 检查', () => {
    it('应该在 devDependencies 中找到依赖', async () => {
      const packageJson = {
        name: 'test',
        devDependencies: {
          typescript: '^5.0.0',
        },
      };
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // 创建假的 node_modules
      const nodeModulesPath = path.join(testDir, 'node_modules', 'typescript');
      fs.mkdirSync(nodeModulesPath, { recursive: true });
      fs.writeFileSync(
        path.join(nodeModulesPath, 'package.json'),
        JSON.stringify({ name: 'typescript' })
      );

      const config: DependencyGraderConfig = {
        type: 'dependency',
        checks: {
          packageName: 'typescript',
        },
      };

      const result = await gradeDependency(testDir, config);

      expect(result.details.packageJson).toBe(true);
    });
  });
});
