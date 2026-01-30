/**
 * 评估配置
 */

import path from 'node:path';

export interface EvalConfig {
  /** 使用的模型 */
  model: string;
  /** 任务超时时间（毫秒） */
  timeout: number;
  /** 临时目录前缀 */
  tempDirPrefix: string;
  /** 结果输出目录 */
  resultsDir: string;
  /** 开发服务器端口 */
  devServerPort: number;
  /** 是否显示详细日志 */
  verbose: boolean;
}

/**
 * 默认配置
 */
export const defaultConfig: EvalConfig = {
  model: 'sonnet',
  timeout: 300000, // 5 分钟
  tempDirPrefix: '/tmp/agent-aware-eval',
  resultsDir: path.join(process.cwd(), 'evals', 'results'),
  devServerPort: 4100,
  verbose: false,
};

/**
 * 从环境变量和命令行参数获取配置
 */
export function getConfig(args: string[] = []): EvalConfig {
  const config = { ...defaultConfig };

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--model':
        if (nextArg) {
          config.model = nextArg;
          i++;
        }
        break;
      case '--timeout':
        if (nextArg) {
          config.timeout = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--results-dir':
        if (nextArg) {
          config.resultsDir = nextArg;
          i++;
        }
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
    }
  }

  // 环境变量覆盖
  if (process.env.EVAL_MODEL) {
    config.model = process.env.EVAL_MODEL;
  }
  if (process.env.EVAL_TIMEOUT) {
    config.timeout = parseInt(process.env.EVAL_TIMEOUT, 10);
  }
  if (process.env.EVAL_RESULTS_DIR) {
    config.resultsDir = process.env.EVAL_RESULTS_DIR;
  }
  if (process.env.EVAL_VERBOSE === 'true') {
    config.verbose = true;
  }

  return config;
}

/**
 * 解析任务过滤参数
 */
export function parseTaskFilter(args: string[]): {
  taskId?: string;
  category?: string;
} {
  const filter: { taskId?: string; category?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--task':
      case '-t':
        if (nextArg) {
          filter.taskId = nextArg;
          i++;
        }
        break;
      case '--category':
      case '-c':
        if (nextArg) {
          filter.category = nextArg;
          i++;
        }
        break;
    }
  }

  // 环境变量
  if (process.env.EVAL_TASK_ID) {
    filter.taskId = process.env.EVAL_TASK_ID;
  }
  if (process.env.EVAL_CATEGORY) {
    filter.category = process.env.EVAL_CATEGORY;
  }

  return filter;
}

/**
 * 打印帮助信息
 */
export function printHelp(): void {
  console.log(`
Agent-Aware 评估系统

用法:
  npx tsx evals/run.ts [选项]

选项:
  --task, -t <id>       运行特定任务（支持前缀匹配，如 001）
  --category, -c <cat>  运行特定分类的任务
  --model <name>        使用的模型（默认: sonnet）
  --timeout <ms>        任务超时时间（默认: 300000）
  --results-dir <path>  结果输出目录
  --verbose, -v         显示详细日志
  --help, -h            显示帮助信息

环境变量:
  EVAL_TASK_ID          等同于 --task
  EVAL_CATEGORY         等同于 --category
  EVAL_MODEL            等同于 --model
  EVAL_TIMEOUT          等同于 --timeout
  EVAL_RESULTS_DIR      等同于 --results-dir
  EVAL_VERBOSE          等同于 --verbose

示例:
  # 运行所有评估
  npx tsx evals/run.ts

  # 运行特定任务
  npx tsx evals/run.ts --task 001

  # 运行 server 分类的任务
  npx tsx evals/run.ts --category server

  # 使用环境变量
  EVAL_TASK_ID=001 npx tsx evals/run.ts
`);
}
