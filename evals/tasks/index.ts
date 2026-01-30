/**
 * 任务注册表
 */

import type { EvalTask } from '../harness/types';

// 导入所有任务
import { task as task001 } from './agent-aware/001-integration';
import { task as task002 } from './agent-aware/002-server-startup';
import { task as task003 } from './agent-aware/003-data-collection';
import { task as task004 } from './agent-aware/004-file-storage';
import { task as task005 } from './agent-aware/005-context-reuse';
import { task as task006 } from './agent-aware/006-ai-detection';
import { task as task007 } from './agent-aware/007-error-handling';
import { task as task008 } from './agent-aware/008-runtime-test';

/**
 * 所有评估任务
 */
export const allTasks: EvalTask[] = [
  task001,
  task002,
  task003,
  task004,
  task005,
  task006,
  task007,
  task008,
];

/**
 * 按任务 ID 获取任务
 */
export function getTaskById(id: string): EvalTask | undefined {
  return allTasks.find((task) => task.id === id);
}

/**
 * 按任务 ID 前缀过滤任务
 */
export function getTasksByPrefix(prefix: string): EvalTask[] {
  return allTasks.filter((task) => task.id.startsWith(prefix));
}

/**
 * 按分类获取任务
 */
export function getTasksByCategory(category: string): EvalTask[] {
  return allTasks.filter((task) => task.category === category);
}

/**
 * 获取所有任务分类
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const task of allTasks) {
    if (task.category) {
      categories.add(task.category);
    }
  }
  return Array.from(categories);
}

// 导出任务 Schema
export * from './schema';
