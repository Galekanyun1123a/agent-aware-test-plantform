/**
 * 进度显示器
 * 在终端实时显示评估进度
 */

import type { EvalTask } from './types';

export type TaskPhase = 'pending' | 'setup' | 'ai' | 'grading' | 'done' | 'error';

interface TaskStatus {
  id: string;
  name: string;
  phase: TaskPhase;
  currentGrader?: string;
  passed?: boolean;
  duration?: number;
  error?: string;
}

export class ProgressDisplay {
  private tasks: Map<string, TaskStatus> = new Map();
  private startTime: number = 0;
  private intervalId?: NodeJS.Timeout;

  constructor(tasks: EvalTask[]) {
    for (const task of tasks) {
      this.tasks.set(task.id, {
        id: task.id,
        name: task.name,
        phase: 'pending',
      });
    }
  }

  /**
   * 开始显示进度
   */
  start(): void {
    this.startTime = Date.now();
    this.render();

    // 每秒更新一次显示
    this.intervalId = setInterval(() => {
      this.render();
    }, 1000);
  }

  /**
   * 设置任务为运行中
   */
  setRunning(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.phase = 'setup';
    }
  }

  /**
   * 设置任务阶段
   */
  setPhase(taskId: string, phase: TaskPhase, grader?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.phase = phase;
      task.currentGrader = grader;
    }
  }

  /**
   * 设置任务结果
   */
  setResult(taskId: string, passed: boolean, duration: number, error?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.phase = error ? 'error' : 'done';
      task.passed = passed;
      task.duration = duration;
      task.error = error;
    }
  }

  /**
   * 渲染进度
   */
  private render(): void {
    // 清屏并移到顶部
    console.clear();

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║           Agent-Aware 评估系统 - 进度报告                         ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║  运行时间: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}                                                    ║`);
    console.log('╠══════════════════════════════════════════════════════════════════╣');

    let completed = 0;
    let passed = 0;

    for (const [, task] of this.tasks) {
      const statusIcon = this.getStatusIcon(task);
      const phaseText = this.getPhaseText(task);
      const durationText = task.duration
        ? `${(task.duration / 1000).toFixed(1)}s`
        : '';

      const line = `║  ${statusIcon} ${task.id.padEnd(20)} ${phaseText.padEnd(20)} ${durationText.padStart(8)} ║`;
      console.log(line);

      if (task.phase === 'done' || task.phase === 'error') {
        completed++;
        if (task.passed) passed++;
      }
    }

    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║  完成: ${completed}/${this.tasks.size}  通过: ${passed}/${completed || 1}  通过率: ${completed ? ((passed / completed) * 100).toFixed(1) : 0}%        ║`);
    console.log('╚══════════════════════════════════════════════════════════════════╝');
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(task: TaskStatus): string {
    switch (task.phase) {
      case 'pending':
        return '⏳';
      case 'setup':
      case 'ai':
      case 'grading':
        return '🔄';
      case 'done':
        return task.passed ? '✅' : '❌';
      case 'error':
        return '💥';
      default:
        return '  ';
    }
  }

  /**
   * 获取阶段文本
   */
  private getPhaseText(task: TaskStatus): string {
    switch (task.phase) {
      case 'pending':
        return '等待中';
      case 'setup':
        return '初始化环境';
      case 'ai':
        return 'AI 对话中';
      case 'grading':
        return task.currentGrader ? `评分: ${task.currentGrader}` : '评分中';
      case 'done':
        return task.passed ? '通过' : '未通过';
      case 'error':
        return `错误: ${task.error?.slice(0, 15) || '未知'}`;
      default:
        return '';
    }
  }

  /**
   * 完成显示
   */
  finish(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.render();
    console.log('\n评估完成！\n');
  }

  /**
   * 获取统计摘要
   */
  getSummary(): { total: number; completed: number; passed: number; failed: number } {
    let completed = 0;
    let passed = 0;
    let failed = 0;

    for (const [, task] of this.tasks) {
      if (task.phase === 'done' || task.phase === 'error') {
        completed++;
        if (task.passed) {
          passed++;
        } else {
          failed++;
        }
      }
    }

    return {
      total: this.tasks.size,
      completed,
      passed,
      failed,
    };
  }
}
