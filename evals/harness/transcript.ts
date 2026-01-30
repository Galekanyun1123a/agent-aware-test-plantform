/**
 * Transcript 记录器
 * 记录完整的评估交互过程
 */

import type { GraderResult, TranscriptEntry, TranscriptEntryType } from './types';

export class TranscriptRecorder {
  private entries: TranscriptEntry[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 获取相对时间戳
   */
  private getTimestamp(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 记录条目
   */
  private record(type: TranscriptEntryType, content: unknown): void {
    this.entries.push({
      timestamp: this.getTimestamp(),
      type,
      content,
    });
  }

  /**
   * 记录用户消息
   */
  recordUserMessage(message: string): void {
    this.record('user_message', { text: message });
  }

  /**
   * 记录助手消息
   */
  recordAssistantMessage(message: string): void {
    this.record('assistant_message', { text: message });
  }

  /**
   * 记录工具调用（包含输入和输出）
   */
  recordToolCall(name: string, input: Record<string, unknown>, output?: unknown): void {
    this.record('tool_call', { name, input, output });
  }

  /**
   * 记录工具结果
   */
  recordToolResult(name: string, result: unknown): void {
    this.record('tool_result', { name, result });
  }

  /**
   * 记录工具调用列表
   */
  recordToolCalls(toolCalls: Array<{ toolName: string; input: Record<string, unknown>; output?: string }>): void {
    for (const call of toolCalls) {
      this.recordToolCall(call.toolName, call.input, call.output);
    }
  }

  /**
   * 记录步骤开始
   */
  recordStepStart(step: string): void {
    this.record('step_start', { step });
  }

  /**
   * 记录步骤完成
   */
  recordStepFinish(step: string, success: boolean): void {
    this.record('step_finish', { step, success });
  }

  /**
   * 记录错误
   */
  recordError(error: Error | string): void {
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    this.record('error', { message, stack });
  }

  /**
   * 记录评分器结果
   */
  recordGraderResult(result: GraderResult): void {
    this.record('grader_result', result);
  }

  /**
   * 记录流式响应块
   */
  recordChunk(chunk: { type: string; [key: string]: unknown }): void {
    // 只记录关键的 chunk 类型，避免过多数据
    if (['tool-call', 'tool-result', 'finish'].includes(chunk.type)) {
      this.record(chunk.type as TranscriptEntryType, chunk);
    }
  }

  /**
   * 获取所有记录
   */
  getEntries(): TranscriptEntry[] {
    return [...this.entries];
  }

  /**
   * 获取记录摘要
   */
  getSummary(): {
    totalEntries: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    errors: number;
    duration: number;
  } {
    const counts = {
      totalEntries: this.entries.length,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      errors: 0,
      duration: this.getTimestamp(),
    };

    for (const entry of this.entries) {
      switch (entry.type) {
        case 'user_message':
          counts.userMessages++;
          break;
        case 'assistant_message':
          counts.assistantMessages++;
          break;
        case 'tool_call':
          counts.toolCalls++;
          break;
        case 'error':
          counts.errors++;
          break;
      }
    }

    return counts;
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.entries = [];
    this.startTime = Date.now();
  }
}
