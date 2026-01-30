/**
 * 命令执行工具
 */

import { execSync, type ExecSyncOptions } from 'node:child_process';

export interface ExecResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ExecError {
  status: number | null;
  stdout: string;
  stderr: string;
  message: string;
}

/**
 * 执行命令
 */
export function execCommand(
  command: string,
  options: ExecSyncOptions = {}
): string {
  const result = execSync(command, {
    encoding: 'utf-8',
    stdio: 'pipe',
    ...options,
  });
  return result;
}

/**
 * 解析执行错误
 */
export function parseExecError(error: unknown): ExecError {
  if (error && typeof error === 'object') {
    const e = error as {
      status?: number | null;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      message?: string;
    };
    return {
      status: e.status ?? null,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
      message: e.message ?? String(error),
    };
  }
  return {
    status: null,
    stdout: '',
    stderr: '',
    message: String(error),
  };
}

/**
 * 获取错误输出
 */
export function getErrorOutput(err: ExecError): string {
  const parts: string[] = [];
  if (err.stdout) parts.push(err.stdout);
  if (err.stderr) parts.push(err.stderr);
  if (parts.length === 0) parts.push(err.message);
  return parts.join('\n');
}

/**
 * 检查是否只是警告
 */
export function isOnlyWarnings(stderr: string): boolean {
  if (!stderr) return true;

  const lines = stderr.split('\n').filter((line) => line.trim());
  return lines.every(
    (line) =>
      line.toLowerCase().includes('warn') ||
      line.toLowerCase().includes('deprecated') ||
      line.startsWith('npm') ||
      line.trim() === ''
  );
}

/**
 * 安全执行命令（不抛出错误）
 */
export function safeExec(
  command: string,
  options: ExecSyncOptions = {}
): ExecResult {
  try {
    const output = execCommand(command, options);
    return { success: true, output };
  } catch (error) {
    const err = parseExecError(error);
    return {
      success: false,
      output: getErrorOutput(err),
      error: err.message,
    };
  }
}
