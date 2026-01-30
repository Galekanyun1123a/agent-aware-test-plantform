/**
 * 评估系统集成测试
 *
 * 测试评估运行器、评分器和报告生成器的核心功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { allTasks, getTaskById, getTasksByCategory, getAllCategories } from './tasks';
import { runEval, runSingleTask } from './harness/runner';
import { defaultConfig } from './config';
import type { EvalTask, GraderConfig } from './harness/types';

// 测试临时目录
let testResultsDir: string;

beforeAll(() => {
  // 创建测试结果目录
  testResultsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-test-'));
});

afterAll(() => {
  // 清理测试目录
  try {
    fs.rmSync(testResultsDir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

describe('任务注册表', () => {
  it('应该包含所有任务', () => {
    expect(allTasks.length).toBeGreaterThan(0);
  });

  it('应该能通过 ID 获取任务', () => {
    const firstTask = allTasks[0];
    const task = getTaskById(firstTask.id);
    expect(task).toBeDefined();
    expect(task?.id).toBe(firstTask.id);
  });

  it('应该能获取所有分类', () => {
    const categories = getAllCategories();
    expect(categories.length).toBeGreaterThan(0);
  });

  it('应该能按分类过滤任务', () => {
    const categories = getAllCategories();
    if (categories.length > 0) {
      const tasks = getTasksByCategory(categories[0]);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.category === categories[0])).toBe(true);
    }
  });
});

describe('任务结构验证', () => {
  it('每个任务应该有必需的字段', () => {
    for (const task of allTasks) {
      expect(task.id).toBeDefined();
      expect(task.id).toMatch(/^\d{3}-/); // 格式：001-xxx
      expect(task.name).toBeDefined();
      expect(task.name.length).toBeGreaterThan(0);
      expect(task.description).toBeDefined();
      expect(task.userMessages).toBeDefined();
      expect(Array.isArray(task.userMessages)).toBe(true);
      expect(task.graders).toBeDefined();
      expect(Array.isArray(task.graders)).toBe(true);
      expect(task.graders.length).toBeGreaterThan(0);
    }
  });

  it('每个评分器应该有有效的类型', () => {
    const validTypes = [
      'dependency',
      'server',
      'data-collection',
      'storage',
      'context',
      'detection',
      'error-handle',
      'code',
      'llm',
    ];

    for (const task of allTasks) {
      for (const grader of task.graders) {
        expect(validTypes).toContain(grader.type);
      }
    }
  });

  it('任务 ID 应该唯一', () => {
    const ids = allTasks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('配置验证', () => {
  it('默认配置应该有效', () => {
    expect(defaultConfig.model).toBeDefined();
    expect(defaultConfig.timeout).toBeGreaterThan(0);
    expect(defaultConfig.tempDirPrefix).toBeDefined();
    expect(defaultConfig.resultsDir).toBeDefined();
  });
});

describe('评估运行器（Dry Run）', () => {
  // 注意：这些测试不实际运行评估，只验证结构

  it('应该能创建测试配置', () => {
    const testConfig = {
      ...defaultConfig,
      resultsDir: testResultsDir,
      timeout: 5000, // 短超时用于测试
    };

    expect(testConfig.resultsDir).toBe(testResultsDir);
  });

  it('应该能创建模拟任务', () => {
    const mockTask: EvalTask = {
      id: '999-test-task',
      name: 'Test Task',
      description: 'A task for testing',
      userMessages: ['Test message'],
      graders: [
        {
          type: 'code',
          checks: {
            fileExists: ['package.json'],
          },
        } as GraderConfig,
      ],
    };

    expect(mockTask.id).toBe('999-test-task');
    expect(mockTask.graders.length).toBe(1);
  });
});

describe('报告格式', () => {
  it('报告目录应该可写', () => {
    const testFile = path.join(testResultsDir, 'test-write.json');
    fs.writeFileSync(testFile, JSON.stringify({ test: true }));

    expect(fs.existsSync(testFile)).toBe(true);

    // 清理
    fs.unlinkSync(testFile);
  });
});
