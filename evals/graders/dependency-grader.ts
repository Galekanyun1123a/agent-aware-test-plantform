/**
 * Dependency Grader - 依赖安装评分器
 *
 * 验证：
 * 1. package.json 中是否包含指定依赖
 * 2. node_modules 中是否已安装该依赖
 * 3. 目标文件中是否正确导入和初始化
 */

import fs from 'node:fs';
import path from 'node:path';
import type { DependencyGraderConfig, GraderResult } from '../harness/types';

/**
 * 检查 package.json 中是否包含依赖
 */
function checkPackageJson(
  projectDir: string,
  packageName: string
): { found: boolean; version?: string; error?: string } {
  const packageJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return { found: false, error: 'package.json 不存在' };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    if (dependencies[packageName]) {
      return { found: true, version: dependencies[packageName] };
    }

    if (devDependencies[packageName]) {
      return { found: true, version: devDependencies[packageName] };
    }

    return { found: false, error: `${packageName} 未在 dependencies 或 devDependencies 中找到` };
  } catch (error) {
    return { found: false, error: `解析 package.json 失败: ${error}` };
  }
}

/**
 * 检查 node_modules 中是否已安装
 */
function checkNodeModules(
  projectDir: string,
  packageName: string
): { installed: boolean; error?: string } {
  const modulePath = path.join(projectDir, 'node_modules', ...packageName.split('/'));

  if (fs.existsSync(modulePath)) {
    // 检查 package.json 是否存在
    const modulePackageJson = path.join(modulePath, 'package.json');
    if (fs.existsSync(modulePackageJson)) {
      return { installed: true };
    }
  }

  return { installed: false, error: `${packageName} 未在 node_modules 中找到` };
}

/**
 * 检查文件中的导入语句
 */
function checkImport(
  projectDir: string,
  targetFile: string,
  importPattern: string
): { found: boolean; match?: string; error?: string } {
  const filePath = path.join(projectDir, targetFile);

  if (!fs.existsSync(filePath)) {
    return { found: false, error: `目标文件 ${targetFile} 不存在` };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = new RegExp(importPattern, 'm');
    const match = content.match(regex);

    if (match) {
      return { found: true, match: match[0] };
    }

    return { found: false, error: `未找到匹配的导入语句: ${importPattern}` };
  } catch (error) {
    return { found: false, error: `读取文件失败: ${error}` };
  }
}

/**
 * 检查文件中的初始化调用
 */
function checkInit(
  projectDir: string,
  targetFile: string,
  initPattern: string
): { found: boolean; match?: string; error?: string } {
  const filePath = path.join(projectDir, targetFile);

  if (!fs.existsSync(filePath)) {
    return { found: false, error: `目标文件 ${targetFile} 不存在` };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = new RegExp(initPattern, 'm');
    const match = content.match(regex);

    if (match) {
      return { found: true, match: match[0] };
    }

    return { found: false, error: `未找到匹配的初始化调用: ${initPattern}` };
  } catch (error) {
    return { found: false, error: `读取文件失败: ${error}` };
  }
}

/**
 * 执行依赖检查评分
 */
export async function gradeDependency(
  projectDir: string,
  config: DependencyGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    packageJson: false,
    nodeModules: false,
    importCheck: false,
    initCheck: false,
  };

  const { packageName, importCheck, initCheck, targetFile } = config.checks;
  const target = targetFile || 'src/main.tsx';

  let totalChecks = 2; // package.json 和 node_modules
  let passedChecks = 0;
  const errors: string[] = [];

  try {
    // 1. 检查 package.json
    const packageResult = checkPackageJson(projectDir, packageName);
    details.packageJson = packageResult.found;
    details.packageVersion = packageResult.version;

    if (packageResult.found) {
      passedChecks++;
    } else if (packageResult.error) {
      errors.push(packageResult.error);
    }

    // 2. 检查 node_modules
    const moduleResult = checkNodeModules(projectDir, packageName);
    details.nodeModules = moduleResult.installed;

    if (moduleResult.installed) {
      passedChecks++;
    } else if (moduleResult.error) {
      errors.push(moduleResult.error);
    }

    // 3. 检查导入语句（可选）
    if (importCheck) {
      totalChecks++;
      const importResult = checkImport(projectDir, target, importCheck);
      details.importCheck = importResult.found;
      details.importMatch = importResult.match;

      if (importResult.found) {
        passedChecks++;
      } else if (importResult.error) {
        errors.push(importResult.error);
      }
    } else {
      details.importCheck = true; // 未配置则视为通过
    }

    // 4. 检查初始化调用（可选）
    if (initCheck) {
      totalChecks++;
      const initResult = checkInit(projectDir, target, initCheck);
      details.initCheck = initResult.found;
      details.initMatch = initResult.match;

      if (initResult.found) {
        passedChecks++;
      } else if (initResult.error) {
        errors.push(initResult.error);
      }
    } else {
      details.initCheck = true; // 未配置则视为通过
    }

    // 计算得分
    const score = passedChecks / totalChecks;
    const passed = score >= 1;

    return {
      type: 'dependency',
      passed,
      score,
      details,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    return {
      type: 'dependency',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
