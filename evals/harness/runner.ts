/**
 * 评估运行器
 * 执行评估任务并收集结果
 * 
 * 支持两种执行模式：
 * - 串行执行：适用于资源有限或需要避免端口冲突的场景
 * - 并行执行：适用于快速完成大量评估任务
 */

import type { EvalConfig } from '../config';
import { gradeDependency } from '../graders/dependency-grader';
import { gradeServer } from '../graders/server-grader';
import { gradeDataCollection } from '../graders/data-collection-grader';
import { gradeStorage } from '../graders/storage-grader';
import { gradeContext } from '../graders/context-grader';
import { gradeDetection } from '../graders/detection-grader';
import { gradeErrorHandle } from '../graders/error-handle-grader';
import { gradeCode } from '../graders/code-grader';
import { gradeLLM } from '../graders/llm-grader';
import { gradeRuntime } from '../graders/runtime-grader';
import { gradeBehavior } from '../graders/behavior-grader';
import { gradeAlert } from '../graders/alert-grader';
import {
  createIsolatedEnvironment,
  listProjectFiles,
  type IsolatedEnvironment,
  type TemplateType,
} from './environment';
import {
  WorkspaceManager,
  type IsolatedWorkspace,
} from './workspace-manager';
import { ProgressDisplay } from './progress';
import { IncrementalReporter } from './reporter';
import { TranscriptRecorder } from './transcript';
import { runAgentTurn, type UIMessage, type AgentTurnResult } from './ai-client';
import type {
  EvalResult,
  EvalTask,
  GraderConfig,
  GraderResult,
  OutcomeState,
  TrialResult,
  RuntimeGraderConfig,
  BehaviorGraderConfig,
  AlertGraderConfig,
} from './types';

// 是否启用真实 AI 调用（可通过环境变量控制）
const ENABLE_REAL_AI = process.env.EVAL_REAL_AI !== 'false';

// ==================== 端口分配器 ====================

/**
 * 端口分配器
 * 为并行任务分配独立的端口，避免冲突
 */
class PortAllocator {
  private basePort: number;
  private portRange: number;
  private allocatedPorts: Set<number> = new Set();
  private portLock: Map<string, number> = new Map();

  constructor(basePort: number = 5200, portRange: number = 100) {
    this.basePort = basePort;
    this.portRange = portRange;
  }

  /**
   * 为任务分配一组端口
   * @returns { devPort: Vite 开发服务器端口, serverPort: Agent-Aware 服务器端口 }
   */
  allocate(taskId: string): { devPort: number; serverPort: number } {
    // 如果任务已分配端口，返回已分配的
    if (this.portLock.has(taskId)) {
      const basePort = this.portLock.get(taskId)!;
      return {
        devPort: basePort,
        serverPort: basePort + 1,
      };
    }

    // 找到未分配的端口
    let port = this.basePort;
    while (this.allocatedPorts.has(port) && port < this.basePort + this.portRange) {
      port += 2; // 每个任务需要 2 个端口
    }

    if (port >= this.basePort + this.portRange) {
      throw new Error('端口资源耗尽，无法分配更多端口');
    }

    this.allocatedPorts.add(port);
    this.allocatedPorts.add(port + 1);
    this.portLock.set(taskId, port);

    return {
      devPort: port,
      serverPort: port + 1,
    };
  }

  /**
   * 释放任务的端口
   */
  release(taskId: string): void {
    const port = this.portLock.get(taskId);
    if (port !== undefined) {
      this.allocatedPorts.delete(port);
      this.allocatedPorts.delete(port + 1);
      this.portLock.delete(taskId);
    }
  }

  /**
   * 获取已分配的端口数
   */
  getAllocatedCount(): number {
    return this.allocatedPorts.size;
  }
}

// 全局端口分配器
const portAllocator = new PortAllocator();

/**
 * 并行执行配置
 */
export interface ParallelConfig {
  /** 最大并发数（默认 3） */
  maxConcurrency: number;
  /** 端口起始值（默认 5200） */
  basePort: number;
  /** 是否启用并行 */
  enabled: boolean;
}

/**
 * 执行单个评分器
 */
async function runGrader(
  graderConfig: GraderConfig,
  env: IsolatedEnvironment,
  recorder: TranscriptRecorder,
  config: EvalConfig
): Promise<GraderResult> {
  recorder.recordStepStart(`grader:${graderConfig.type}`);

  try {
    let result: GraderResult;

    switch (graderConfig.type) {
      case 'dependency':
        result = await gradeDependency(env.projectDir, graderConfig);
        break;
      case 'server':
        result = await gradeServer(env.projectDir, graderConfig, env);
        break;
      case 'data-collection':
        result = await gradeDataCollection(env.projectDir, graderConfig);
        break;
      case 'storage':
        result = await gradeStorage(env.projectDir, graderConfig);
        break;
      case 'context':
        result = await gradeContext(env.projectDir, graderConfig, recorder);
        break;
      case 'detection':
        result = await gradeDetection(env.projectDir, graderConfig);
        break;
      case 'error-handle':
        result = await gradeErrorHandle(env.projectDir, graderConfig, env);
        break;
      case 'code':
        result = await gradeCode(env.projectDir, graderConfig);
        break;
      case 'llm':
        result = await gradeLLM(env.projectDir, graderConfig);
        break;
      case 'runtime':
        result = await gradeRuntime(env.projectDir, graderConfig as RuntimeGraderConfig);
        break;
      case 'behavior':
        result = await gradeBehavior(env.projectDir, graderConfig as BehaviorGraderConfig);
        break;
      case 'alert':
        result = await gradeAlert(env.projectDir, graderConfig as AlertGraderConfig);
        break;
      default:
        throw new Error(`未知的评分器类型: ${(graderConfig as GraderConfig).type}`);
    }

    recorder.recordStepFinish(`grader:${graderConfig.type}`, result.passed);
    recorder.recordGraderResult(result);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    recorder.recordStepFinish(`grader:${graderConfig.type}`, false);
    recorder.recordError(error instanceof Error ? error : new Error(errorMsg));

    return {
      type: graderConfig.type,
      passed: false,
      score: 0,
      details: {},
      error: errorMsg,
    };
  }
}

/**
 * 任务执行上下文
 * 包含任务专属的端口和配置
 */
interface TaskContext {
  /** 开发服务器端口 */
  devPort: number;
  /** Agent-Aware 服务器端口 */
  serverPort: number;
  /** 任务索引（用于日志） */
  taskIndex: number;
  /** 总任务数 */
  totalTasks: number;
}

/**
 * 替换字符串中的端口占位符
 * 支持的占位符:
 * - {{SERVER_PORT}} - Agent-Aware 服务器端口
 * - {{DEV_PORT}} - Vite 开发服务器端口
 * - 4100 (直接替换) - 兼容旧任务中硬编码的 4100 端口
 */
function replacePortPlaceholders(str: string, context: TaskContext): string {
  return str
    .replace(/\{\{SERVER_PORT\}\}/g, String(context.serverPort))
    .replace(/\{\{DEV_PORT\}\}/g, String(context.devPort))
    // 兼容旧任务：将硬编码的 4100 替换为动态端口
    .replace(/\b4100\b/g, String(context.serverPort));
}

/**
 * 重写任务中的端口配置
 * 用于并行执行时为每个任务分配独立端口
 * 
 * 会替换以下内容中的端口:
 * 1. graders 配置中的 port 字段
 * 2. setupScript 中的端口占位符和硬编码端口
 * 3. userMessages 中的端口占位符和硬编码端口
 */
function rewriteTaskPorts(task: EvalTask, context: TaskContext): EvalTask {
  // 1. 重写 graders 中的端口
  const rewrittenGraders = task.graders.map((grader) => {
    if (grader.type === 'server') {
      return { ...grader, port: context.serverPort };
    }
    if (grader.type === 'runtime') {
      return { ...grader, port: context.devPort };
    }
    if (grader.type === 'data-collection') {
      return { ...grader, port: context.serverPort };
    }
    if (grader.type === 'error-handle') {
      return { ...grader, port: context.serverPort };
    }
    return grader;
  });

  // 2. 重写 setupScript 中的端口
  const rewrittenSetupScript = task.setupScript
    ? replacePortPlaceholders(task.setupScript, context)
    : undefined;

  // 3. 重写 userMessages 中的端口
  const rewrittenUserMessages = task.userMessages.map((msg) =>
    replacePortPlaceholders(msg, context)
  );

  return {
    ...task,
    graders: rewrittenGraders,
    setupScript: rewrittenSetupScript,
    userMessages: rewrittenUserMessages,
  };
}

/**
 * 运行单次试验
 * @param task 评估任务
 * @param trialIndex 试验索引
 * @param config 评估配置
 * @param progress 进度显示器
 * @param context 任务上下文（可选，用于并行执行）
 */
async function runTrial(
  task: EvalTask,
  trialIndex: number,
  config: EvalConfig,
  progress: ProgressDisplay,
  context?: TaskContext
): Promise<TrialResult> {
  const startTime = Date.now();
  const recorder = new TranscriptRecorder();
  const taskLabel = context
    ? `[${context.taskIndex + 1}/${context.totalTasks}] ${task.id}`
    : task.id;

  let env: IsolatedEnvironment | undefined;

  try {
    // 1. 创建隔离环境 (setup 阶段)
    progress.setPhase(task.id, 'setup');
    recorder.recordStepStart('setup');

    env = await createIsolatedEnvironment(task.id, config, task.setupScript, task.templateId);

    recorder.recordStepFinish('setup', true);

    // 2. 执行 AI 对话阶段
    progress.setPhase(task.id, 'ai');
    recorder.recordStepStart('ai');

    // 不再使用全局环境变量，改为传递参数
    // process.env.WORKSPACE_PATH = env.projectDir;

    let messages: UIMessage[] = [];
    let totalToolCalls = 0;

    if (ENABLE_REAL_AI) {
      // 真实 AI 调用模式
      console.log(`🤖 [${taskLabel}] 启用真实 AI 调用，共 ${task.userMessages.length} 轮对话`);
      console.log(`📁 [${taskLabel}] 工作目录: ${env.projectDir}`);
      if (context) {
        console.log(`🔌 [${taskLabel}] 端口: dev=${context.devPort}, server=${context.serverPort}`);
      }

      for (const message of task.userMessages) {
        const result: AgentTurnResult = await runAgentTurn({
          userMessage: message,
          previousMessages: messages,
          model: config.model,
          recorder,
          timeout: task.timeout ?? config.timeout,
          workspacePath: env.projectDir,  // 传递隔离环境路径
        });

        messages = result.messages;
        totalToolCalls += result.toolCalls.length;
      }

      console.log(`🔧 [${taskLabel}] 共执行 ${totalToolCalls} 个工具调用`);
    } else {
      // 模拟模式（用于测试评估框架本身）
      console.log(`🔧 [${taskLabel}] 模拟模式，跳过 AI 调用`);

      for (const message of task.userMessages) {
        recorder.recordUserMessage(message);
        recorder.recordAssistantMessage(`[模拟响应] 已处理: ${message.slice(0, 50)}...`);
      }
    }

    recorder.recordStepFinish('ai', true);

    // 3. 执行评分器 (grading 阶段)
    progress.setPhase(task.id, 'grading');
    const graderResults: GraderResult[] = [];

    for (const graderConfig of task.graders) {
      progress.setPhase(task.id, 'grading', graderConfig.type);

      const result = await runGrader(graderConfig, env, recorder, config);
      graderResults.push(result);
    }

    // 4. 构建 Outcome
    const files = await listProjectFiles(env.projectDir);

    const outcome: OutcomeState = {
      files,
      serverStarted: graderResults.some((r) => r.type === 'server' && r.passed),
      dataCollected: graderResults.some((r) => r.type === 'data-collection' && r.passed),
      fileStored: graderResults.some((r) => r.type === 'storage' && r.passed),
      consoleErrors: [],
    };

    // 5. 计算总体结果
    const passed = graderResults.every((r) => r.passed);
    const scores: Record<string, number> = {};
    for (const r of graderResults) {
      scores[r.type] = r.score;
    }

    return {
      taskId: task.id,
      trialIndex,
      passed,
      scores,
      graderResults,
      transcript: recorder.getEntries(),
      outcome,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    recorder.recordError(error instanceof Error ? error : new Error(String(error)));

    return {
      taskId: task.id,
      trialIndex,
      passed: false,
      scores: {},
      graderResults: [],
      transcript: recorder.getEntries(),
      outcome: {
        files: [],
        serverStarted: false,
        dataCollected: false,
        fileStored: false,
        consoleErrors: [],
      },
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // 清理环境
    if (env) {
      await env.cleanup();
    }
    // 释放端口
    if (context) {
      portAllocator.release(task.id);
    }
  }
}

// 串行模式的端口分配器（确保串行模式也使用动态端口）
const serialPortAllocator = new PortAllocator(5200, 100);

/**
 * 执行单个任务（串行模式）
 * 也会为任务分配动态端口，避免硬编码端口冲突
 */
async function runTask(
  task: EvalTask,
  config: EvalConfig,
  progress: ProgressDisplay,
  taskIndex: number = 0,
  totalTasks: number = 1
): Promise<EvalResult> {
  // 为串行任务分配端口
  const ports = serialPortAllocator.allocate(task.id);
  
  const context: TaskContext = {
    devPort: ports.devPort,
    serverPort: ports.serverPort,
    taskIndex,
    totalTasks,
  };

  // 重写任务端口配置
  const rewrittenTask = rewriteTaskPorts(task, context);

  console.log(`🔌 [${task.id}] 使用端口: dev=${ports.devPort}, server=${ports.serverPort}`);

  try {
    const trial = await runTrial(rewrittenTask, 0, config, progress, context);

    return {
      taskId: task.id,
      passed: trial.passed,
      trial,
      duration: trial.duration,
    };
  } finally {
    // 释放端口
    serialPortAllocator.release(task.id);
  }
}

/**
 * 运行完整评估（带增量报告和进度显示）
 * 串行执行所有任务
 */
export async function runEval(
  tasks: EvalTask[],
  config: EvalConfig,
  resultsDir: string
): Promise<{ results: EvalResult[]; reporter: IncrementalReporter }> {
  // 创建进度显示器
  const progress = new ProgressDisplay(tasks);
  progress.start();

  // 创建增量报告管理器
  const reporter = new IncrementalReporter(config, resultsDir, tasks.length);
  await reporter.init();

  // 存储结果
  const results: EvalResult[] = [];

  // 串行执行任务
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    progress.setRunning(task.id);

    const result = await runTask(task, config, progress, i, tasks.length);
    results.push(result);

    // 更新进度显示
    progress.setResult(
      task.id,
      result.passed,
      result.duration,
      result.trial.error
    );

    // 每完成一个任务就更新报告
    await reporter.addResult(result);
  }

  // 完成进度显示
  progress.finish();

  return { results, reporter };
}

/**
 * 运行单个任务（用于调试）
 */
export async function runSingleTask(
  task: EvalTask,
  config: EvalConfig,
  resultsDir: string
): Promise<EvalResult> {
  const progress = new ProgressDisplay([task]);
  progress.start();

  const reporter = new IncrementalReporter(config, resultsDir, 1);
  await reporter.init();

  progress.setRunning(task.id);

  const result = await runTask(task, config, progress);

  progress.setResult(task.id, result.passed, result.duration, result.trial.error);
  await reporter.addResult(result);

  progress.finish();

  return result;
}

// ==================== 并行执行 ====================

/**
 * 并发控制器
 * 实现有限并发的任务执行
 */
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrency) {
      this.running++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

/**
 * 并行运行评估任务
 * 
 * 每个任务会获得完全隔离的 workspace：
 * - 独立的项目目录
 * - 独立的端口配置
 * - 独立的 .agent-aware 检测目录
 * 
 * @param tasks 评估任务列表
 * @param config 评估配置
 * @param resultsDir 结果输出目录
 * @param parallelConfig 并行配置
 */
export async function runEvalParallel(
  tasks: EvalTask[],
  config: EvalConfig,
  resultsDir: string,
  parallelConfig: ParallelConfig = { maxConcurrency: 3, basePort: 5200, enabled: true }
): Promise<{ results: EvalResult[]; reporter: IncrementalReporter }> {
  const { maxConcurrency } = parallelConfig;

  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║           Agent-Aware 评估系统 (并行模式)                         ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════╣`);
  console.log(`║  任务数: ${tasks.length.toString().padEnd(55)} ║`);
  console.log(`║  并发数: ${maxConcurrency.toString().padEnd(55)} ║`);
  console.log(`║  模型:   ${config.model.padEnd(55)} ║`);
  console.log(`║  隔离:   每个任务独立 workspace + 端口${' '.repeat(27)} ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

  // 创建 Workspace 管理器
  const workspaceManager = new WorkspaceManager(config);

  // 创建进度显示器
  const progress = new ProgressDisplay(tasks);
  progress.start();

  // 创建增量报告管理器
  const reporter = new IncrementalReporter(config, resultsDir, tasks.length);
  await reporter.init();

  // 创建并发限制器
  const limiter = new ConcurrencyLimiter(maxConcurrency);

  // 并行执行所有任务
  const taskPromises = tasks.map((task, index) => {
    progress.setRunning(task.id);
    return runTaskWithIsolatedWorkspace(
      task,
      index,
      tasks.length,
      config,
      progress,
      limiter,
      workspaceManager
    );
  });

  // 收集结果（按完成顺序）
  const results: EvalResult[] = [];
  const resultPromises = taskPromises.map(async (promise) => {
    const result = await promise;
    results.push(result);

    // 更新进度显示
    progress.setResult(
      result.taskId,
      result.passed,
      result.duration,
      result.trial.error
    );

    // 更新报告
    await reporter.addResult(result);

    console.log(`\n✅ [Parallel] 完成任务 ${results.length}/${tasks.length}: ${result.taskId} (${result.passed ? '通过' : '未通过'})`);

    return result;
  });

  // 等待所有任务完成
  await Promise.all(resultPromises);

  // 清理所有 workspace（除非配置保留）
  if (!config.keepTempDir) {
    await workspaceManager.cleanupAll();
  } else {
    console.log(`\n📁 保留临时目录，共 ${workspaceManager.getActiveCount()} 个 workspace`);
    for (const ws of workspaceManager.getAll()) {
      if (!ws.cleaned) {
        console.log(`   - ${ws.taskId}: ${ws.projectDir}`);
      }
    }
  }

  // 完成进度显示
  progress.finish();

  // 按任务 ID 排序结果
  results.sort((a, b) => a.taskId.localeCompare(b.taskId));

  return { results, reporter };
}

/**
 * 使用隔离 Workspace 运行任务
 */
async function runTaskWithIsolatedWorkspace(
  task: EvalTask,
  taskIndex: number,
  totalTasks: number,
  config: EvalConfig,
  progress: ProgressDisplay,
  limiter: ConcurrencyLimiter,
  workspaceManager: WorkspaceManager
): Promise<EvalResult> {
  // 获取并发许可
  await limiter.acquire();

  let workspace: IsolatedWorkspace | undefined;

  try {
    // 先创建 workspace 获取分配的端口（不执行 setupScript）
    workspace = await workspaceManager.create(task.id, {
      setupScript: undefined, // 暂不执行 setupScript
      copyTemplate: true,
    });

    const context: TaskContext = {
      devPort: workspace.devPort,
      serverPort: workspace.serverPort,
      taskIndex,
      totalTasks,
    };

    // 重写任务端口配置（包括 setupScript 中的端口）
    const rewrittenTask = rewriteTaskPorts(task, context);

    // 执行重写后的 setupScript
    if (rewrittenTask.setupScript) {
      try {
        console.log(`🔧 [Workspace] 执行初始化脚本 (端口: ${context.serverPort})...`);
        const { execSync } = await import('node:child_process');
        execSync(rewrittenTask.setupScript, {
          cwd: workspace.projectDir,
          stdio: 'pipe',
          timeout: 30000,
          shell: true,
        });
      } catch (error) {
        console.warn(`⚠️ [Workspace] 初始化脚本执行失败: ${error}`);
      }
    }

    console.log(`\n🚀 [Parallel] 开始任务 ${taskIndex + 1}/${totalTasks}: ${task.id}`);
    console.log(`   Workspace: ${workspace.projectDir}`);
    console.log(`   端口: dev=${workspace.devPort}, server=${workspace.serverPort}`);

    // 使用隔离的 workspace 路径运行试验
    const trial = await runTrialWithWorkspace(
      rewrittenTask,
      0,
      config,
      progress,
      workspace,
      context
    );

    return {
      taskId: task.id,
      passed: trial.passed,
      trial,
      duration: trial.duration,
    };
  } finally {
    // 释放并发许可
    limiter.release();
    
    // 清理 workspace（如果不需要保留）
    if (workspace && !config.keepTempDir) {
      await workspaceManager.cleanup(workspace.id);
    }
  }
}

/**
 * 使用指定 Workspace 运行试验
 */
async function runTrialWithWorkspace(
  task: EvalTask,
  trialIndex: number,
  config: EvalConfig,
  progress: ProgressDisplay,
  workspace: IsolatedWorkspace,
  context: TaskContext
): Promise<TrialResult> {
  const startTime = Date.now();
  const recorder = new TranscriptRecorder();
  const taskLabel = `[${context.taskIndex + 1}/${context.totalTasks}] ${task.id}`;

  // 创建一个轻量级的环境对象，使用已存在的 workspace
  const env: IsolatedEnvironment = {
    projectDir: workspace.projectDir,
    agentAwareDir: workspace.agentAwareDir,
    serverProcesses: [],
    addServerProcess: (proc) => {
      env.serverProcesses.push(proc);
    },
    cleanup: async () => {
      // 终止服务器进程
      for (const proc of env.serverProcesses) {
        try {
          if (!proc.killed) {
            proc.kill('SIGTERM');
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }
        } catch {
          // 忽略
        }
      }
    },
  };

  try {
    // 1. setup 阶段（已在创建 workspace 时完成）
    progress.setPhase(task.id, 'setup');
    recorder.recordStepStart('setup');
    recorder.recordStepFinish('setup', true);

    // 2. 执行 AI 对话阶段
    progress.setPhase(task.id, 'ai');
    recorder.recordStepStart('ai');

    let messages: UIMessage[] = [];
    let totalToolCalls = 0;

    if (ENABLE_REAL_AI) {
      console.log(`🤖 [${taskLabel}] 启用真实 AI 调用，共 ${task.userMessages.length} 轮对话`);
      console.log(`📁 [${taskLabel}] 隔离工作目录: ${workspace.projectDir}`);

      for (const message of task.userMessages) {
        const result: AgentTurnResult = await runAgentTurn({
          userMessage: message,
          previousMessages: messages,
          model: config.model,
          recorder,
          timeout: task.timeout ?? config.timeout,
          workspacePath: workspace.projectDir, // 使用隔离的 workspace 路径
        });

        messages = result.messages;
        totalToolCalls += result.toolCalls.length;
      }

      console.log(`🔧 [${taskLabel}] 共执行 ${totalToolCalls} 个工具调用`);
    } else {
      console.log(`🔧 [${taskLabel}] 模拟模式，跳过 AI 调用`);

      for (const message of task.userMessages) {
        recorder.recordUserMessage(message);
        recorder.recordAssistantMessage(`[模拟响应] 已处理: ${message.slice(0, 50)}...`);
      }
    }

    recorder.recordStepFinish('ai', true);

    // 3. 执行评分器
    progress.setPhase(task.id, 'grading');
    const graderResults: GraderResult[] = [];

    for (const graderConfig of task.graders) {
      progress.setPhase(task.id, 'grading', graderConfig.type);
      const result = await runGrader(graderConfig, env, recorder, config);
      graderResults.push(result);
    }

    // 4. 构建 Outcome
    const files = await listProjectFiles(workspace.projectDir);

    const outcome: OutcomeState = {
      files,
      serverStarted: graderResults.some((r) => r.type === 'server' && r.passed),
      dataCollected: graderResults.some((r) => r.type === 'data-collection' && r.passed),
      fileStored: graderResults.some((r) => r.type === 'storage' && r.passed),
      consoleErrors: [],
    };

    // 5. 计算总体结果
    const passed = graderResults.every((r) => r.passed);
    const scores: Record<string, number> = {};
    for (const r of graderResults) {
      scores[r.type] = r.score;
    }

    return {
      taskId: task.id,
      trialIndex,
      passed,
      scores,
      graderResults,
      transcript: recorder.getEntries(),
      outcome,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    recorder.recordError(error instanceof Error ? error : new Error(String(error)));

    return {
      taskId: task.id,
      trialIndex,
      passed: false,
      scores: {},
      graderResults: [],
      transcript: recorder.getEntries(),
      outcome: {
        files: [],
        serverStarted: false,
        dataCollected: false,
        fileStored: false,
        consoleErrors: [],
      },
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // 清理服务器进程
    await env.cleanup();
  }
}

/**
 * 智能选择执行模式
 * 根据任务数量和配置自动选择串行或并行
 */
export async function runEvalSmart(
  tasks: EvalTask[],
  config: EvalConfig,
  resultsDir: string,
  options: {
    forceParallel?: boolean;
    forceSerial?: boolean;
    maxConcurrency?: number;
  } = {}
): Promise<{ results: EvalResult[]; reporter: IncrementalReporter }> {
  const { forceParallel, forceSerial, maxConcurrency = 3 } = options;

  // 决定执行模式
  let useParallel = false;

  if (forceSerial) {
    useParallel = false;
  } else if (forceParallel) {
    useParallel = true;
  } else {
    // 自动决定：任务数 >= 3 且没有依赖冲突时使用并行
    useParallel = tasks.length >= 3;
  }

  if (useParallel) {
    return runEvalParallel(tasks, config, resultsDir, {
      maxConcurrency,
      basePort: 5200,
      enabled: true,
    });
  } else {
    return runEval(tasks, config, resultsDir);
  }
}
