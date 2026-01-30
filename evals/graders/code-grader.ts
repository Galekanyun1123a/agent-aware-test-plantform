/**
 * Code Grader - 代码检查评分器
 *
 * 验证：
 * 1. 依赖安装是否成功
 * 2. 构建是否成功
 * 3. 指定文件是否存在
 * 4. 文件内容是否包含预期内容
 */

import fs from 'node:fs';
import path from 'node:path';
import type { CodeGraderConfig, GraderResult } from '../harness/types';
import { safeExec } from './shared/exec-utils';

const INSTALL_TIMEOUT = 120000; // 2 分钟
const BUILD_TIMEOUT = 60000; // 1 分钟

/**
 * 执行 npm install
 */
function runNpmInstall(projectDir: string): {
  success: boolean;
  output: string;
  error?: string;
} {
  const result = safeExec('npm install', {
    cwd: projectDir,
    timeout: INSTALL_TIMEOUT,
  });

  return {
    success: result.success,
    output: result.output.slice(-500),
    error: result.success ? undefined : result.error,
  };
}

/**
 * 执行 npm run build
 */
function runNpmBuild(projectDir: string): {
  success: boolean;
  output: string;
  error?: string;
} {
  const result = safeExec('npm run build', {
    cwd: projectDir,
    timeout: BUILD_TIMEOUT,
  });

  return {
    success: result.success,
    output: result.output.slice(-500),
    error: result.success ? undefined : result.error,
  };
}

/**
 * 检查文件是否存在
 */
function checkFilesExist(
  projectDir: string,
  files: string[]
): { allExist: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const file of files) {
    const filePath = path.join(projectDir, file);
    if (!fs.existsSync(filePath)) {
      missing.push(file);
    }
  }

  return {
    allExist: missing.length === 0,
    missing,
  };
}

/**
 * 检查文件内容
 */
function checkFileContains(
  projectDir: string,
  checks: Array<{ file: string; pattern: string }>
): { allMatch: boolean; results: Array<{ file: string; matched: boolean }> } {
  const results: Array<{ file: string; matched: boolean }> = [];

  for (const check of checks) {
    const filePath = path.join(projectDir, check.file);

    if (!fs.existsSync(filePath)) {
      results.push({ file: check.file, matched: false });
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const regex = new RegExp(check.pattern, 'm');
      const matched = regex.test(content);
      results.push({ file: check.file, matched });
    } catch {
      results.push({ file: check.file, matched: false });
    }
  }

  return {
    allMatch: results.every((r) => r.matched),
    results,
  };
}

/**
 * 执行代码检查评分
 */
export async function gradeCode(
  projectDir: string,
  config: CodeGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    npmInstall: null,
    npmBuild: null,
    filesExist: null,
    fileContains: null,
  };

  const checks = {
    npmInstall: config.checks.npmInstall ?? false,
    npmBuild: config.checks.npmBuild ?? false,
    fileExists: config.checks.fileExists ?? [],
    fileContains: config.checks.fileContains ?? [],
  };

  let totalChecks = 0;
  let passedChecks = 0;
  const errors: string[] = [];

  try {
    // 1. npm install
    if (checks.npmInstall) {
      totalChecks++;
      const installResult = runNpmInstall(projectDir);
      details.npmInstall = installResult;

      if (installResult.success) {
        passedChecks++;
      } else {
        errors.push(`npm install 失败: ${installResult.error}`);
      }
    }

    // 2. npm build
    if (checks.npmBuild) {
      totalChecks++;
      const buildResult = runNpmBuild(projectDir);
      details.npmBuild = buildResult;

      if (buildResult.success) {
        passedChecks++;
      } else {
        errors.push(`npm build 失败: ${buildResult.error}`);
      }
    }

    // 3. 文件存在检查
    if (checks.fileExists.length > 0) {
      totalChecks++;
      const existResult = checkFilesExist(projectDir, checks.fileExists);
      details.filesExist = existResult;

      if (existResult.allExist) {
        passedChecks++;
      } else {
        errors.push(`缺少文件: ${existResult.missing.join(', ')}`);
      }
    }

    // 4. 文件内容检查
    if (checks.fileContains.length > 0) {
      totalChecks++;
      const containsResult = checkFileContains(projectDir, checks.fileContains);
      details.fileContains = containsResult;

      if (containsResult.allMatch) {
        passedChecks++;
      } else {
        const failed = containsResult.results
          .filter((r) => !r.matched)
          .map((r) => r.file);
        errors.push(`文件内容不匹配: ${failed.join(', ')}`);
      }
    }

    // 计算得分
    const score = totalChecks > 0 ? passedChecks / totalChecks : 1;
    const passed = totalChecks === 0 || passedChecks === totalChecks;

    return {
      type: 'code',
      passed,
      score,
      details,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    return {
      type: 'code',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
