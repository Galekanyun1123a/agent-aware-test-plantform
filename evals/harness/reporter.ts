/**
 * 评估报告生成器
 * 支持增量更新和多种格式输出
 */

import fs from 'node:fs';
import path from 'node:path';
import type { EvalConfig } from '../config';
import type { EvalReport, EvalResult, TranscriptEntry } from './types';

export class IncrementalReporter {
  private config: EvalConfig;
  private resultsDir: string;
  private totalTasks: number;
  private results: EvalResult[] = [];
  private reportPath: string;
  private transcriptDir: string;

  constructor(config: EvalConfig, resultsDir: string, totalTasks: number) {
    this.config = config;
    this.resultsDir = resultsDir;
    this.totalTasks = totalTasks;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.reportPath = path.join(resultsDir, `report-${timestamp}`);
    this.transcriptDir = path.join(resultsDir, 'transcripts');
  }

  /**
   * 初始化报告目录
   */
  async init(): Promise<void> {
    // 创建结果目录
    fs.mkdirSync(this.resultsDir, { recursive: true });
    fs.mkdirSync(this.transcriptDir, { recursive: true });

    // 创建初始报告
    await this.writeReport();
  }

  /**
   * 添加评估结果
   */
  async addResult(result: EvalResult): Promise<void> {
    this.results.push(result);

    // 保存 Transcript
    await this.saveTranscript(result.taskId, result.trial.transcript);

    // 更新报告
    await this.writeReport();
  }

  /**
   * 保存 Transcript
   */
  private async saveTranscript(taskId: string, transcript: TranscriptEntry[]): Promise<void> {
    const transcriptPath = path.join(this.transcriptDir, `${taskId}.json`);
    fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
  }

  /**
   * 写入报告
   */
  private async writeReport(): Promise<void> {
    const report = this.buildReport();

    // 写入 JSON 报告
    fs.writeFileSync(`${this.reportPath}.json`, JSON.stringify(report, null, 2));

    // 写入 Markdown 报告
    fs.writeFileSync(`${this.reportPath}.md`, this.buildMarkdownReport(report));
  }

  /**
   * 构建报告数据
   */
  private buildReport(): EvalReport {
    const passedTasks = this.results.filter((r) => r.passed).length;
    const passRate = this.results.length > 0
      ? ((passedTasks / this.results.length) * 100).toFixed(1)
      : '0.0';

    return {
      timestamp: new Date().toISOString(),
      model: this.config.model,
      progress: {
        completed: this.results.length,
        total: this.totalTasks,
        percentage: ((this.results.length / this.totalTasks) * 100).toFixed(1),
      },
      results: this.results,
      summary: {
        totalTasks: this.totalTasks,
        passedTasks,
        passRate: `${passRate}%`,
      },
    };
  }

  /**
   * 构建 Markdown 报告
   */
  private buildMarkdownReport(report: EvalReport): string {
    let md = `# Agent-Aware 评估报告\n\n`;
    md += `**生成时间**: ${report.timestamp}\n`;
    md += `**模型**: ${report.model}\n`;
    md += `**进度**: ${report.progress.completed}/${report.progress.total} (${report.progress.percentage}%)\n\n`;

    // 汇总表格
    md += `## 汇总\n\n`;
    md += `| 指标 | 值 |\n`;
    md += `|------|----|\n`;
    md += `| 总任务数 | ${report.summary.totalTasks} |\n`;
    md += `| 通过任务数 | ${report.summary.passedTasks} |\n`;
    md += `| 通过率 | ${report.summary.passRate} |\n\n`;

    // 任务详情
    md += `## 任务详情\n\n`;
    md += `| 任务 ID | 状态 | 耗时 | 评分器结果 |\n`;
    md += `|---------|------|------|------------|\n`;

    for (const result of report.results) {
      const status = result.passed ? '✅ 通过' : '❌ 未通过';
      const duration = `${(result.duration / 1000).toFixed(1)}s`;
      const graderScores = result.trial.graderResults
        .map((g) => `${g.type}: ${(g.score * 100).toFixed(0)}%`)
        .join(', ');

      md += `| ${result.taskId} | ${status} | ${duration} | ${graderScores} |\n`;
    }

    // 失败分析
    const failedResults = report.results.filter((r) => !r.passed);
    if (failedResults.length > 0) {
      md += `\n## 失败分析\n\n`;

      for (const result of failedResults) {
        md += `### ${result.taskId}\n\n`;

        if (result.trial.error) {
          md += `**错误**: ${result.trial.error}\n\n`;
        }

        const failedGraders = result.trial.graderResults.filter((g) => !g.passed);
        if (failedGraders.length > 0) {
          md += `**未通过的评分器**:\n\n`;
          for (const grader of failedGraders) {
            md += `- ${grader.type}: ${grader.error || '分数未达标'}\n`;
            md += `  - 分数: ${(grader.score * 100).toFixed(0)}%\n`;
            if (Object.keys(grader.details).length > 0) {
              md += `  - 详情: ${JSON.stringify(grader.details)}\n`;
            }
          }
          md += '\n';
        }

        md += `**Transcript**: [查看详情](transcripts/${result.taskId}.json)\n\n`;
      }
    }

    return md;
  }

  /**
   * 获取报告路径
   */
  getReportPath(): string {
    return this.reportPath;
  }

  /**
   * 获取最终报告
   */
  getFinalReport(): EvalReport {
    return this.buildReport();
  }
}
