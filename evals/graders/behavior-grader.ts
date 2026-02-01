/**
 * Behavior Grader - 用户行为检测评分器
 *
 * 检测 AI Agent 是否能正确识别和响应 .agent-aware/behavior.json 中的用户行为问题：
 * - 挫折行为（frustration）：挫折指数 >= 70 为严重
 * - 愤怒点击（rage click）：连续快速点击 >= 3 次
 * - 死点击（dead click）：点击无响应元素 >= 2 次
 *
 * 对应 getSystemPrompt 中描述的 BehaviorDetector 检测器
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GraderResult } from '../harness/types';

/**
 * 行为检测评分器配置
 */
export interface BehaviorGraderConfig {
  type: 'behavior';
  /** 检查的行为类型 */
  checks: {
    /** 是否检查挫折检测 */
    frustration?: boolean;
    /** 是否检查愤怒点击检测 */
    rageClick?: boolean;
    /** 是否检查死点击检测 */
    deadClick?: boolean;
    /** 是否检查 AI 修复响应 */
    aiResponse?: boolean;
  };
  /** 预期严重程度 */
  expectedSeverity?: 'critical' | 'warning' | 'info';
  /** 行为文件路径（相对于项目目录） */
  behaviorFilePath?: string;
}

/**
 * 行为检测文件结构
 */
interface BehaviorDetection {
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'frustration' | 'rage_click' | 'dead_click' | 'behavior';
  summary: string;
  details: {
    frustrationScore?: number;
    rageClickCount?: number;
    deadClickCount?: number;
    [key: string]: unknown;
  };
}

/**
 * 执行行为检测评分
 */
export async function gradeBehavior(
  projectDir: string,
  config: BehaviorGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    behaviorFileExists: false,
    behaviorDetected: false,
    severity: null,
    detectionType: null,
    checks: {},
  };

  const behaviorFilePath = config.behaviorFilePath || '.agent-aware/behavior.json';
  const fullPath = path.join(projectDir, behaviorFilePath);

  const checks = {
    frustration: config.checks.frustration ?? true,
    rageClick: config.checks.rageClick ?? true,
    deadClick: config.checks.deadClick ?? true,
    aiResponse: config.checks.aiResponse ?? false,
  };

  let score = 0;
  let passedChecks = 0;
  let totalChecks = 0;
  const errors: string[] = [];

  try {
    // 1. 检查行为文件是否存在
    if (!fs.existsSync(fullPath)) {
      details.behaviorFileExists = false;
      details.error = `行为检测文件不存在: ${behaviorFilePath}`;
      return {
        type: 'behavior',
        passed: false,
        score: 0,
        details,
        error: `行为检测文件不存在: ${behaviorFilePath}`,
      };
    }

    details.behaviorFileExists = true;

    // 2. 读取行为检测文件
    let behaviorData: BehaviorDetection;
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      behaviorData = JSON.parse(content);
      details.behaviorData = behaviorData;
    } catch (parseError) {
      return {
        type: 'behavior',
        passed: false,
        score: 0,
        details,
        error: `行为检测文件解析失败: ${parseError}`,
      };
    }

    details.behaviorDetected = true;
    details.severity = behaviorData.severity;
    details.detectionType = behaviorData.type;

    // 3. 检查严重程度
    if (config.expectedSeverity) {
      totalChecks++;
      if (behaviorData.severity === config.expectedSeverity) {
        passedChecks++;
        details.severityMatch = true;
      } else {
        errors.push(`严重程度不匹配: 期望 ${config.expectedSeverity}, 实际 ${behaviorData.severity}`);
        details.severityMatch = false;
      }
    }

    // 4. 检查挫折检测
    if (checks.frustration) {
      totalChecks++;
      const frustrationScore = behaviorData.details.frustrationScore ?? 0;
      details.checks = {
        ...details.checks as Record<string, unknown>,
        frustration: { score: frustrationScore },
      };

      if (frustrationScore > 0) {
        passedChecks++;
        // 根据挫折指数给分
        if (frustrationScore >= 70) {
          score += 1;
        } else if (frustrationScore >= 50) {
          score += 0.7;
        } else {
          score += 0.5;
        }
      } else if (behaviorData.type === 'frustration') {
        passedChecks++;
        score += 1;
      }
    }

    // 5. 检查愤怒点击
    if (checks.rageClick) {
      totalChecks++;
      const rageClickCount = behaviorData.details.rageClickCount ?? 0;
      details.checks = {
        ...details.checks as Record<string, unknown>,
        rageClick: { count: rageClickCount },
      };

      if (rageClickCount >= 3 || behaviorData.type === 'rage_click') {
        passedChecks++;
        score += 1;
      } else if (rageClickCount > 0) {
        passedChecks += 0.5;
        score += 0.5;
      }
    }

    // 6. 检查死点击
    if (checks.deadClick) {
      totalChecks++;
      const deadClickCount = behaviorData.details.deadClickCount ?? 0;
      details.checks = {
        ...details.checks as Record<string, unknown>,
        deadClick: { count: deadClickCount },
      };

      if (deadClickCount >= 2 || behaviorData.type === 'dead_click') {
        passedChecks++;
        score += 1;
      } else if (deadClickCount > 0) {
        passedChecks += 0.5;
        score += 0.5;
      }
    }

    // 7. 计算最终分数
    const activeChecks = Object.values(checks).filter(Boolean).length;
    const normalizedScore = activeChecks > 0 ? score / activeChecks : 0;

    // 如果有检测到任何行为问题，基本分数为 0.5
    const finalScore = behaviorData.type ? Math.max(0.5, normalizedScore) : normalizedScore;

    const passed = totalChecks === 0 || passedChecks >= totalChecks * 0.7;

    return {
      type: 'behavior',
      passed,
      score: Math.min(1, finalScore),
      details,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    return {
      type: 'behavior',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 创建模拟的行为检测数据（用于测试）
 */
export function createMockBehaviorData(
  severity: 'critical' | 'warning' | 'info',
  type: 'frustration' | 'rage_click' | 'dead_click',
  options: {
    frustrationScore?: number;
    rageClickCount?: number;
    deadClickCount?: number;
  } = {}
): BehaviorDetection {
  const summaries = {
    frustration: '检测到用户挫折行为',
    rage_click: '检测到用户愤怒点击行为',
    dead_click: '检测到用户死点击行为',
  };

  return {
    timestamp: new Date().toISOString(),
    severity,
    type,
    summary: summaries[type],
    details: {
      frustrationScore: options.frustrationScore ?? (type === 'frustration' ? 75 : 0),
      rageClickCount: options.rageClickCount ?? (type === 'rage_click' ? 5 : 0),
      deadClickCount: options.deadClickCount ?? (type === 'dead_click' ? 3 : 0),
    },
  };
}
