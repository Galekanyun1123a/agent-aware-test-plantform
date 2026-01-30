/**
 * Storage Grader - 文件存储评分器
 *
 * 验证：
 * 1. 存储文件是否创建
 * 2. 文件内容格式是否正确
 * 3. 数据是否追加而非覆盖
 * 4. 数据结构是否完整
 */

import fs from 'node:fs';
import path from 'node:path';
import type { StorageGraderConfig, GraderResult } from '../harness/types';

/**
 * 检查文件是否存在
 */
function checkFileExists(projectDir: string, filePath: string): boolean {
  const fullPath = path.join(projectDir, filePath);
  return fs.existsSync(fullPath);
}

/**
 * 读取并解析 JSON 文件
 */
function readJsonFile(
  projectDir: string,
  filePath: string
): { success: boolean; data?: unknown; error?: string } {
  const fullPath = path.join(projectDir, filePath);

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');

    // 尝试解析为 JSON
    try {
      const data = JSON.parse(content);
      return { success: true, data };
    } catch {
      // 如果不是标准 JSON，尝试解析为 JSONL（每行一个 JSON）
      const lines = content.trim().split('\n').filter(Boolean);
      const data = lines.map((line) => JSON.parse(line));
      return { success: true, data };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 验证数据结构
 */
function validateDataStructure(
  data: unknown,
  expectedFields: string[]
): { valid: boolean; records: number; validRecords: number; issues: string[] } {
  const issues: string[] = [];
  let validRecords = 0;

  // 确保是数组
  if (!Array.isArray(data)) {
    return {
      valid: false,
      records: 0,
      validRecords: 0,
      issues: ['数据不是数组格式'],
    };
  }

  const records = data.length;

  // 检查每条记录
  for (let i = 0; i < data.length; i++) {
    const record = data[i];

    if (!record || typeof record !== 'object') {
      issues.push(`记录 ${i}: 不是有效的对象`);
      continue;
    }

    let recordValid = true;
    for (const field of expectedFields) {
      if (!(field in record)) {
        issues.push(`记录 ${i}: 缺少字段 "${field}"`);
        recordValid = false;
      }
    }

    if (recordValid) {
      validRecords++;
    }
  }

  return {
    valid: validRecords === records && records > 0,
    records,
    validRecords,
    issues,
  };
}

/**
 * 执行文件存储评分
 */
export async function gradeStorage(
  projectDir: string,
  config: StorageGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    fileExists: false,
    fileReadable: false,
    isValidJson: false,
    recordCount: 0,
    validRecords: 0,
    meetsMinRecords: false,
    structureValid: false,
    issues: [],
  };

  const { filePath, minRecords = 1, expectedFields = [] } = config;

  try {
    // 1. 检查文件是否存在
    const exists = checkFileExists(projectDir, filePath);
    details.fileExists = exists;

    if (!exists) {
      return {
        type: 'storage',
        passed: false,
        score: 0,
        details,
        error: `存储文件 ${filePath} 不存在`,
      };
    }

    // 2. 读取文件内容
    const readResult = readJsonFile(projectDir, filePath);
    details.fileReadable = readResult.success;
    details.isValidJson = readResult.success;

    if (!readResult.success) {
      return {
        type: 'storage',
        passed: false,
        score: 0.25,
        details,
        error: readResult.error,
      };
    }

    // 3. 验证数据结构
    const validation = validateDataStructure(readResult.data, expectedFields);
    details.recordCount = validation.records;
    details.validRecords = validation.validRecords;
    details.structureValid = validation.valid;
    details.issues = validation.issues;

    // 4. 检查最少记录数
    details.meetsMinRecords = validation.records >= minRecords;

    if (!details.meetsMinRecords) {
      return {
        type: 'storage',
        passed: false,
        score: 0.5,
        details,
        error: `记录数 (${validation.records}) 少于要求 (${minRecords})`,
      };
    }

    // 5. 计算得分
    let score = 0;
    score += 0.25; // 文件存在
    score += 0.25; // 文件可读
    score += (validation.validRecords / validation.records) * 0.25; // 数据有效性
    score += details.meetsMinRecords ? 0.25 : 0; // 记录数要求

    const passed = score >= 0.75 && validation.valid;

    return {
      type: 'storage',
      passed,
      score,
      details,
      error: passed ? undefined : validation.issues.slice(0, 3).join('; '),
    };
  } catch (error) {
    return {
      type: 'storage',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
