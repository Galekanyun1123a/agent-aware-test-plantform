/**
 * Detection Grader - AI 检测能力评分器
 *
 * 验证：
 * 1. AI 能识别出数据中的问题
 * 2. AI 提出的修复方案合理
 * 3. 修复后的数据格式正确
 */

import fs from 'node:fs';
import path from 'node:path';
import type { DetectionGraderConfig, GraderResult } from '../harness/types';

/**
 * 检查数据问题
 */
interface DataIssue {
  type: string;
  description: string;
  recordIndex?: number;
}

/**
 * 分析数据问题
 */
function analyzeDataIssues(data: unknown[]): DataIssue[] {
  const issues: DataIssue[] = [];

  for (let i = 0; i < data.length; i++) {
    const record = data[i];

    if (!record || typeof record !== 'object') {
      issues.push({
        type: 'invalid_record',
        description: '无效的记录（不是对象）',
        recordIndex: i,
      });
      continue;
    }

    const obj = record as Record<string, unknown>;

    // 检查缺少 event_type
    if (!('event_type' in obj) || obj.event_type === undefined) {
      issues.push({
        type: 'missing_event_type',
        description: '缺少 event_type 字段',
        recordIndex: i,
      });
    } else if (obj.event_type === null) {
      issues.push({
        type: 'null_event_type',
        description: 'event_type 为 null',
        recordIndex: i,
      });
    }

    // 检查缺少 timestamp
    if (!('timestamp' in obj) || obj.timestamp === undefined) {
      issues.push({
        type: 'missing_timestamp',
        description: '缺少 timestamp 字段',
        recordIndex: i,
      });
    } else if (typeof obj.timestamp === 'string' && isNaN(Number(obj.timestamp))) {
      issues.push({
        type: 'invalid_timestamp',
        description: 'timestamp 格式错误（非数字）',
        recordIndex: i,
      });
    } else if (typeof obj.timestamp !== 'number' && typeof obj.timestamp !== 'string') {
      issues.push({
        type: 'invalid_timestamp_type',
        description: 'timestamp 类型错误',
        recordIndex: i,
      });
    }
  }

  return issues;
}

/**
 * 读取数据文件
 */
function readDataFile(projectDir: string, filePath: string): {
  success: boolean;
  data?: unknown[];
  error?: string;
} {
  const fullPath = path.join(projectDir, filePath);

  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `文件 ${filePath} 不存在` };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      return { success: false, error: '数据不是数组格式' };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 检查是否检测到预期的问题类型
 */
function checkDetectedIssues(
  foundIssues: DataIssue[],
  expectedIssueTypes: string[]
): { detected: string[]; missed: string[] } {
  const detectedTypes = new Set(foundIssues.map((i) => i.type));
  const detected: string[] = [];
  const missed: string[] = [];

  for (const expected of expectedIssueTypes) {
    // 模糊匹配
    const found = Array.from(detectedTypes).some(
      (type) =>
        type.includes(expected) ||
        expected.includes(type) ||
        type.toLowerCase().includes(expected.toLowerCase())
    );

    if (found) {
      detected.push(expected);
    } else {
      missed.push(expected);
    }
  }

  return { detected, missed };
}

/**
 * 执行检测能力评分
 */
export async function gradeDetection(
  projectDir: string,
  config: DetectionGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    originalFileRead: false,
    issuesFound: [],
    expectedIssues: config.issues,
    detectedIssues: [],
    missedIssues: [],
    fixedFileExists: false,
    fixedFileValid: false,
  };

  const { issues: expectedIssues, fixedFilePath } = config;

  try {
    // 1. 读取原始数据文件（如果有修复后的文件，先检查原始文件）
    const originalPath = fixedFilePath || 'data/behaviors.json';
    const readResult = readDataFile(projectDir, originalPath);

    if (!readResult.success) {
      // 尝试读取备份文件
      const backupPath = originalPath.replace('.json', '.backup.json');
      const backupResult = readDataFile(projectDir, backupPath);

      if (backupResult.success) {
        details.originalFileRead = true;
        details.originalData = backupResult.data?.slice(0, 5);

        // 分析原始数据的问题
        const foundIssues = analyzeDataIssues(backupResult.data!);
        details.issuesFound = foundIssues;

        // 检查是否检测到预期问题
        const detection = checkDetectedIssues(foundIssues, expectedIssues);
        details.detectedIssues = detection.detected;
        details.missedIssues = detection.missed;
      } else {
        return {
          type: 'detection',
          passed: false,
          score: 0,
          details,
          error: `无法读取数据文件: ${readResult.error}`,
        };
      }
    } else {
      details.originalFileRead = true;

      // 分析数据问题
      const foundIssues = analyzeDataIssues(readResult.data!);
      details.issuesFound = foundIssues;

      // 检查是否检测到预期问题
      const detection = checkDetectedIssues(foundIssues, expectedIssues);
      details.detectedIssues = detection.detected;
      details.missedIssues = detection.missed;
    }

    // 2. 如果有修复后的文件路径，检查修复结果
    if (fixedFilePath) {
      const fixedResult = readDataFile(projectDir, fixedFilePath);
      details.fixedFileExists = fixedResult.success;

      if (fixedResult.success) {
        const fixedIssues = analyzeDataIssues(fixedResult.data!);
        details.fixedFileValid = fixedIssues.length === 0;
        details.remainingIssues = fixedIssues;
      }
    }

    // 3. 计算得分
    const detectedCount = (details.detectedIssues as string[]).length;
    const expectedCount = expectedIssues.length;
    const detectionScore = expectedCount > 0 ? detectedCount / expectedCount : 0;

    // 如果有修复文件，加入修复得分
    let score = detectionScore;
    if (fixedFilePath && details.fixedFileExists) {
      score = detectionScore * 0.6 + (details.fixedFileValid ? 0.4 : 0.2);
    }

    const passed = score >= 0.6;

    return {
      type: 'detection',
      passed,
      score,
      details,
      error: passed
        ? undefined
        : `检测到 ${detectedCount}/${expectedCount} 个问题`,
    };
  } catch (error) {
    return {
      type: 'detection',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
