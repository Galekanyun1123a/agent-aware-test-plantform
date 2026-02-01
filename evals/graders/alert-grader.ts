/**
 * Alert Grader - 错误检测评分器
 *
 * 检测 AI Agent 是否能正确识别和响应 .agent-aware/error.json 中的运行时错误：
 * - 运行时错误（Runtime Error）
 * - Promise 异常（Unhandled Promise Rejection）
 * - Console 错误（Console Error）
 *
 * 对应 getSystemPrompt 中描述的 AlertDetector 检测器
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GraderResult } from '../harness/types';

/**
 * 错误检测评分器配置
 */
export interface AlertGraderConfig {
  type: 'alert';
  /** 检查配置 */
  checks: {
    /** 是否检查错误文件存在 */
    fileExists?: boolean;
    /** 期望的错误数量（最少） */
    minErrorCount?: number;
    /** 期望的错误类型 */
    errorTypes?: Array<'runtime' | 'promise' | 'console'>;
    /** 是否检查 AI 修复响应 */
    aiResponse?: boolean;
    /** 期望包含的错误消息关键词 */
    errorMessageContains?: string[];
  };
  /** 错误文件路径（相对于项目目录） */
  errorFilePath?: string;
}

/**
 * 单个错误记录
 */
interface ErrorRecord {
  message: string;
  type?: 'runtime' | 'promise' | 'console' | string;
  stack?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * 错误检测文件结构
 */
interface ErrorDetection {
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'error';
  summary: string;
  details: {
    totalErrors: number;
    recentErrors: ErrorRecord[];
    [key: string]: unknown;
  };
}

/**
 * 执行错误检测评分
 */
export async function gradeAlert(
  projectDir: string,
  config: AlertGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    errorFileExists: false,
    errorDetected: false,
    totalErrors: 0,
    recentErrors: [],
    checks: {},
  };

  const errorFilePath = config.errorFilePath || '.agent-aware/error.json';
  const fullPath = path.join(projectDir, errorFilePath);

  const checks = {
    fileExists: config.checks.fileExists ?? true,
    minErrorCount: config.checks.minErrorCount ?? 1,
    errorTypes: config.checks.errorTypes ?? [],
    aiResponse: config.checks.aiResponse ?? false,
    errorMessageContains: config.checks.errorMessageContains ?? [],
  };

  let score = 0;
  let passedChecks = 0;
  let totalChecks = 0;
  const errors: string[] = [];

  try {
    // 1. 检查错误文件是否存在
    if (!fs.existsSync(fullPath)) {
      details.errorFileExists = false;

      if (checks.fileExists) {
        return {
          type: 'alert',
          passed: false,
          score: 0,
          details,
          error: `错误检测文件不存在: ${errorFilePath}`,
        };
      } else {
        // 如果不要求文件存在，则跳过
        return {
          type: 'alert',
          passed: true,
          score: 1,
          details: { ...details, skipped: true },
        };
      }
    }

    details.errorFileExists = true;
    totalChecks++;
    passedChecks++;

    // 2. 读取错误检测文件
    let errorData: ErrorDetection;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      errorData = JSON.parse(content);
      details.errorData = errorData;
    } catch (parseError) {
      return {
        type: 'alert',
        passed: false,
        score: 0.1,
        details,
        error: `错误检测文件解析失败: ${parseError}`,
      };
    }

    details.errorDetected = true;
    details.totalErrors = errorData.details.totalErrors;
    details.recentErrors = errorData.details.recentErrors;
    details.severity = errorData.severity;

    // 3. 检查错误数量
    if (checks.minErrorCount > 0) {
      totalChecks++;
      const actualCount = errorData.details.totalErrors;

      if (actualCount >= checks.minErrorCount) {
        passedChecks++;
        score += 1;
        details.checks = {
          ...details.checks as Record<string, unknown>,
          errorCount: { expected: checks.minErrorCount, actual: actualCount, passed: true },
        };
      } else {
        errors.push(`错误数量不足: 期望 >= ${checks.minErrorCount}, 实际 ${actualCount}`);
        details.checks = {
          ...details.checks as Record<string, unknown>,
          errorCount: { expected: checks.minErrorCount, actual: actualCount, passed: false },
        };
      }
    }

    // 4. 检查错误类型
    if (checks.errorTypes.length > 0) {
      totalChecks++;
      const actualTypes = errorData.details.recentErrors.map((e) => e.type).filter(Boolean);
      const hasExpectedTypes = checks.errorTypes.some((t) => actualTypes.includes(t));

      if (hasExpectedTypes) {
        passedChecks++;
        score += 1;
        details.checks = {
          ...details.checks as Record<string, unknown>,
          errorTypes: { expected: checks.errorTypes, actual: actualTypes, passed: true },
        };
      } else {
        errors.push(`未找到期望的错误类型: ${checks.errorTypes.join(', ')}`);
        details.checks = {
          ...details.checks as Record<string, unknown>,
          errorTypes: { expected: checks.errorTypes, actual: actualTypes, passed: false },
        };
      }
    }

    // 5. 检查错误消息内容
    if (checks.errorMessageContains.length > 0) {
      totalChecks++;
      const allMessages = errorData.details.recentErrors
        .map((e) => e.message || '')
        .join(' ');

      const foundKeywords = checks.errorMessageContains.filter((kw) =>
        allMessages.toLowerCase().includes(kw.toLowerCase())
      );

      if (foundKeywords.length > 0) {
        passedChecks++;
        score += foundKeywords.length / checks.errorMessageContains.length;
        details.checks = {
          ...details.checks as Record<string, unknown>,
          errorMessage: {
            expected: checks.errorMessageContains,
            found: foundKeywords,
            passed: true,
          },
        };
      } else {
        errors.push(`错误消息中未找到关键词: ${checks.errorMessageContains.join(', ')}`);
        details.checks = {
          ...details.checks as Record<string, unknown>,
          errorMessage: {
            expected: checks.errorMessageContains,
            found: [],
            passed: false,
          },
        };
      }
    }

    // 6. 计算最终分数
    const normalizedScore = totalChecks > 0 ? score / totalChecks : 1;

    // 如果检测到错误，基本分数为 0.5
    const hasErrors = errorData.details.totalErrors > 0;
    const finalScore = hasErrors ? Math.max(0.5, normalizedScore) : normalizedScore;

    const passed = totalChecks === 0 || passedChecks >= totalChecks * 0.7;

    return {
      type: 'alert',
      passed,
      score: Math.min(1, finalScore),
      details,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    return {
      type: 'alert',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 创建模拟的错误检测数据（用于测试）
 */
export function createMockErrorData(
  errorCount: number,
  errorMessages: string[] = [],
  errorType: 'runtime' | 'promise' | 'console' = 'runtime'
): ErrorDetection {
  const recentErrors: ErrorRecord[] = errorMessages.map((message, index) => ({
    message,
    type: errorType,
    timestamp: new Date(Date.now() - index * 1000).toISOString(),
    stack: `Error: ${message}\n    at Component.tsx:${10 + index}`,
  }));

  // 如果没有提供消息，生成默认错误
  if (recentErrors.length === 0 && errorCount > 0) {
    for (let i = 0; i < Math.min(errorCount, 5); i++) {
      recentErrors.push({
        message: `Test error ${i + 1}`,
        type: errorType,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    severity: errorCount >= 1 ? 'critical' : 'warning',
    type: 'error',
    summary: `检测到 ${errorCount} 个运行时错误`,
    details: {
      totalErrors: errorCount,
      recentErrors,
    },
  };
}

/**
 * 常见错误类型的消息模板
 */
export const commonErrorMessages = {
  undefined: "Cannot read property 'foo' of undefined",
  null: "Cannot read property 'bar' of null",
  type: 'TypeError: x is not a function',
  reference: 'ReferenceError: x is not defined',
  network: 'Failed to fetch',
  syntax: 'Unexpected token',
  promise: 'Unhandled promise rejection',
};
