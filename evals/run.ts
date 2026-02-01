#!/usr/bin/env tsx
/**
 * 评估运行入口
 * CLI 工具，用于运行评估任务
 * 
 * 支持两种执行模式：
 * - 串行执行（默认）：适用于资源有限或需要避免端口冲突的场景
 * - 并行执行（--parallel）：适用于快速完成大量评估任务
 */

import { runEval, runEvalParallel, runSingleTask } from './harness/runner';
import { getConfig, parseTaskFilter, printHelp } from './config';
import {
  allTasks,
  getTaskById,
  getTasksByPrefix,
  getTasksByCategory,
  getAllCategories,
} from './tasks';
import type { EvalTask } from './harness/types';

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  // 帮助信息
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // 列出分类
  if (args.includes('--list-categories')) {
    console.log('可用的任务分类:');
    for (const category of getAllCategories()) {
      const tasks = getTasksByCategory(category);
      console.log(`  ${category}: ${tasks.length} 个任务`);
    }
    process.exit(0);
  }

  // 列出任务
  if (args.includes('--list-tasks')) {
    console.log('可用的评估任务:\n');
    for (const task of allTasks) {
      console.log(`  ${task.id}`);
      console.log(`    名称: ${task.name}`);
      console.log(`    分类: ${task.category || '无'}`);
      console.log(`    描述: ${task.description.slice(0, 60)}...`);
      console.log('');
    }
    process.exit(0);
  }

  // 获取配置
  const config = getConfig(args);
  const filter = parseTaskFilter(args);

  const executionMode = config.parallel.enabled ? '并行' : '串行';
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           Agent-Aware 评估系统                                    ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  模型: ${config.model.padEnd(56)} ║`);
  console.log(`║  超时: ${(config.timeout / 1000).toFixed(0)}s${' '.repeat(54)} ║`);
  console.log(`║  模式: ${executionMode}${config.parallel.enabled ? ` (并发数: ${config.parallel.maxConcurrency})` : ''}${' '.repeat(config.parallel.enabled ? 43 : 54)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // 确定要运行的任务
  let tasksToRun: EvalTask[] = [];

  if (filter.taskId) {
    // 尝试精确匹配
    const exactTask = getTaskById(filter.taskId);
    if (exactTask) {
      tasksToRun = [exactTask];
    } else {
      // 尝试前缀匹配
      tasksToRun = getTasksByPrefix(filter.taskId);
    }

    if (tasksToRun.length === 0) {
      console.error(`❌ 未找到匹配的任务: ${filter.taskId}`);
      console.log('运行 --list-tasks 查看所有可用任务');
      process.exit(1);
    }
  } else if (filter.category) {
    tasksToRun = getTasksByCategory(filter.category);

    if (tasksToRun.length === 0) {
      console.error(`❌ 未找到分类: ${filter.category}`);
      console.log('运行 --list-categories 查看所有可用分类');
      process.exit(1);
    }
  } else {
    tasksToRun = allTasks;
  }

  console.log(`📋 将运行 ${tasksToRun.length} 个任务:\n`);
  for (const task of tasksToRun) {
    console.log(`   - ${task.id}: ${task.name}`);
  }
  console.log('');

  // 运行评估
  try {
    // 根据配置选择执行模式
    const { results, reporter } = config.parallel.enabled
      ? await runEvalParallel(tasksToRun, config, config.resultsDir, config.parallel)
      : await runEval(tasksToRun, config, config.resultsDir);

    // 输出最终报告
    const report = reporter.getFinalReport();

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                        评估完成                                   ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║  总任务数: ${report.summary.totalTasks.toString().padEnd(52)} ║`);
    console.log(`║  通过任务: ${report.summary.passedTasks.toString().padEnd(52)} ║`);
    console.log(`║  通过率:   ${report.summary.passRate.padEnd(52)} ║`);
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║  执行模式: ${(config.parallel.enabled ? '并行' : '串行').padEnd(52)} ║`);
    console.log(`║  报告路径: ${reporter.getReportPath().slice(-50).padEnd(52)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    // 返回退出码
    const failed = results.filter((r) => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ 评估过程中发生错误:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
