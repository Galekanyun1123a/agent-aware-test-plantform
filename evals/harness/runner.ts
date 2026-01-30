/**
 * 评估运行器
 * 执行评估任务并收集结果
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
import {
  createIsolatedEnvironment,
  listProjectFiles,
  type IsolatedEnvironment,
} from './environment';
import { ProgressDisplay } from './progress';
import { IncrementalReporter } from './reporter';
import { TranscriptRecorder } from './transcript';
import type {
  EvalResult,
  EvalTask,
  GraderConfig,
  GraderResult,
  OutcomeState,
  TrialResult,
} from './types';

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
 * 运行单次试验
 */
async function runTrial(
  task: EvalTask,
  trialIndex: number,
  config: EvalConfig,
  progress: ProgressDisplay
): Promise<TrialResult> {
  const startTime = Date.now();
  const recorder = new TranscriptRecorder();

  let env: IsolatedEnvironment | undefined;

  try {
    // 1. 创建隔离环境 (setup 阶段)
    progress.setPhase(task.id, 'setup');
    recorder.recordStepStart('setup');

    env = await createIsolatedEnvironment(task.id, config, task.setupScript);

    recorder.recordStepFinish('setup', true);

    // 2. 记录用户消息（模拟 AI 对话阶段）
    progress.setPhase(task.id, 'ai');
    recorder.recordStepStart('ai');

    for (const message of task.userMessages) {
      recorder.recordUserMessage(message);
      // 在实际实现中，这里会调用 AI 模型
      // 目前只记录消息用于评分
      recorder.recordAssistantMessage(`[模拟响应] 已处理: ${message.slice(0, 50)}...`);
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
  }
}

/**
 * 执行单个任务
 */
async function runTask(
  task: EvalTask,
  config: EvalConfig,
  progress: ProgressDisplay
): Promise<EvalResult> {
  const trial = await runTrial(task, 0, config, progress);

  return {
    taskId: task.id,
    passed: trial.passed,
    trial,
    duration: trial.duration,
  };
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
  for (const task of tasks) {
    progress.setRunning(task.id);

    const result = await runTask(task, config, progress);
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
