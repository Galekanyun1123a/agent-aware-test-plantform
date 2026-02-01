/**
 * 评估配置
 * 
 * 配置项对应 getSystemPrompt 中定义的工作环境
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
  /** 开发服务器端口（Vite 默认 5173） */
  devServerPort: number;
  /** Agent-Aware 服务器端口（默认 4100） */
  agentAwareServerPort: number;
  /** 是否显示详细日志 */
  verbose: boolean;
  /** 是否启用真实 AI 调用 */
  enableRealAI: boolean;
  /** AI API URL */
  aiApiUrl: string;
  /** 是否保留临时目录（用于调试） */
  keepTempDir: boolean;
  /** 浏览器超时时间（毫秒） */
  browserTimeout: number;
  /** 并行执行配置 */
  parallel: {
    /** 是否启用并行执行 */
    enabled: boolean;
    /** 最大并发数 */
    maxConcurrency: number;
    /** 端口起始值 */
    basePort: number;
  };
}

/**
 * 默认配置
 */
export const defaultConfig: EvalConfig = {
  model: 'sonnet',
  timeout: 300000, // 5 分钟
  tempDirPrefix: '/tmp/agent-aware-eval',
  resultsDir: path.join(process.cwd(), 'evals', 'results'),
  devServerPort: 5173, // Vite 默认端口
  agentAwareServerPort: 4100, // Agent-Aware 服务器端口
  verbose: false,
  enableRealAI: true,
  aiApiUrl: process.env.AI_API_URL || 'http://localhost:3000/api/ai-stream',
  keepTempDir: false,
  browserTimeout: 30000,
  parallel: {
    enabled: false, // 默认串行
    maxConcurrency: 3, // 默认最大 3 个并发
    basePort: 5200, // 并行时端口起始值
  },
};

/**
 * 从环境变量和命令行参数获取配置
 */
export function getConfig(args: string[] = []): EvalConfig {
  const config = { ...defaultConfig, parallel: { ...defaultConfig.parallel } };

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
      case '--keep-temp':
        config.keepTempDir = true;
        break;
      case '--no-ai':
        config.enableRealAI = false;
        break;
      case '--api-url':
        if (nextArg) {
          config.aiApiUrl = nextArg;
          i++;
        }
        break;
      case '--browser-timeout':
        if (nextArg) {
          config.browserTimeout = parseInt(nextArg, 10);
          i++;
        }
        break;
      // 并行执行相关参数
      case '--parallel':
      case '-p':
        config.parallel.enabled = true;
        break;
      case '--serial':
        config.parallel.enabled = false;
        break;
      case '--concurrency':
      case '-j':
        if (nextArg) {
          config.parallel.enabled = true;
          config.parallel.maxConcurrency = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--base-port':
        if (nextArg) {
          config.parallel.basePort = parseInt(nextArg, 10);
          i++;
        }
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
  if (process.env.EVAL_REAL_AI === 'false') {
    config.enableRealAI = false;
  }
  if (process.env.AI_API_URL) {
    config.aiApiUrl = process.env.AI_API_URL;
  }
  if (process.env.EVAL_KEEP_TEMP === 'true') {
    config.keepTempDir = true;
  }
  // 并行执行环境变量
  if (process.env.EVAL_PARALLEL === 'true') {
    config.parallel.enabled = true;
  }
  if (process.env.EVAL_CONCURRENCY) {
    config.parallel.maxConcurrency = parseInt(process.env.EVAL_CONCURRENCY, 10);
  }
  if (process.env.EVAL_BASE_PORT) {
    config.parallel.basePort = parseInt(process.env.EVAL_BASE_PORT, 10);
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

基于 getSystemPrompt 系统提示的评估框架，用于测试 AI Agent 在以下方面的能力：
- @reskill/agent-aware 库的正确集成
- 用户行为检测响应（.agent-aware/behavior.json）
- 运行时错误检测响应（.agent-aware/error.json）
- Vite + React + TypeScript 项目开发

用法:
  npx tsx evals/run.ts [选项]

任务筛选:
  --task, -t <id>       运行特定任务（支持前缀匹配，如 001）
  --category, -c <cat>  运行特定分类的任务
  --list-tasks          列出所有可用任务
  --list-categories     列出所有任务分类

执行模式:
  --parallel, -p        启用并行执行模式
  --serial              强制串行执行（默认）
  --concurrency, -j <n> 设置最大并发数（默认: 3，自动启用并行）
  --base-port <port>    并行执行时端口起始值（默认: 5200）

配置选项:
  --model <name>        使用的模型（默认: sonnet）
  --timeout <ms>        任务超时时间（默认: 300000）
  --results-dir <path>  结果输出目录
  --verbose, -v         显示详细日志
  --keep-temp           保留临时目录（用于调试）
  --no-ai               禁用真实 AI 调用（测试评估框架）
  --api-url <url>       AI API 地址
  --browser-timeout <ms> 浏览器操作超时时间
  --help, -h            显示帮助信息

环境变量:
  EVAL_TASK_ID          等同于 --task
  EVAL_CATEGORY         等同于 --category
  EVAL_MODEL            等同于 --model
  EVAL_TIMEOUT          等同于 --timeout
  EVAL_RESULTS_DIR      等同于 --results-dir
  EVAL_VERBOSE          等同于 --verbose
  EVAL_REAL_AI          设为 false 禁用真实 AI 调用
  EVAL_KEEP_TEMP        设为 true 保留临时目录
  AI_API_URL            AI API 地址
  EVAL_PARALLEL         设为 true 启用并行执行
  EVAL_CONCURRENCY      设置最大并发数
  EVAL_BASE_PORT        并行执行时端口起始值

任务分类:
  integration           Agent-Aware 基础集成测试
  server                行为数据服务器测试
  data                  数据收集和存储测试
  ai-detection          AI 主动检测能力测试
  agent-aware-detection Agent-Aware 检测响应测试
  runtime               运行时页面测试

示例:
  # 运行所有评估（串行）
  npx tsx evals/run.ts

  # 运行所有评估（并行，3 个并发）
  npx tsx evals/run.ts --parallel

  # 运行所有评估（并行，5 个并发）
  npx tsx evals/run.ts -j 5

  # 运行特定任务
  npx tsx evals/run.ts --task 001

  # 并行运行某分类的任务
  npx tsx evals/run.ts --category integration --parallel

  # 调试模式（保留临时文件，详细日志）
  npx tsx evals/run.ts --task 009 --verbose --keep-temp

  # 测试评估框架（不调用真实 AI）
  npx tsx evals/run.ts --no-ai --task 001

并行执行说明:
  - 每个并行任务会分配独立的端口，避免冲突
  - 端口分配从 --base-port 开始，每个任务占用 2 个端口
  - 建议并发数不超过 CPU 核心数
  - 可通过 --verbose 查看每个任务的端口分配
`);
}
