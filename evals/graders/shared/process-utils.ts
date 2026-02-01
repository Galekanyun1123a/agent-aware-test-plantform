/**
 * 进程管理工具
 * 提供进程启动、监控和清理功能
 */

import { exec, spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * 进程管理器配置
 */
export interface ProcessConfig {
  /** 工作目录 */
  cwd: string;
  /** 命令 */
  command: string;
  /** 参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;
  /** 启动超时（毫秒） */
  timeout?: number;
  /** 是否使用 shell */
  shell?: boolean;
  /** 就绪检测函数 */
  readyCheck?: () => Promise<boolean>;
  /** 就绪检测间隔（毫秒） */
  readyInterval?: number;
}

/**
 * 进程状态
 */
export interface ProcessStatus {
  running: boolean;
  pid?: number;
  exitCode?: number | null;
  error?: string;
}

/**
 * 启动子进程
 */
export async function startProcess(config: ProcessConfig): Promise<{
  process: ChildProcess;
  status: ProcessStatus;
  stop: () => Promise<void>;
}> {
  const {
    cwd,
    command,
    args = [],
    env = {},
    timeout = 30000,
    shell = true,
    readyCheck,
    readyInterval = 500,
  } = config;

  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
      env: { ...process.env, ...env },
      detached: false,
    };

    // 解析命令
    let cmd: string;
    let cmdArgs: string[];

    if (shell) {
      cmd = command;
      cmdArgs = args;
    } else {
      const parts = command.split(' ');
      cmd = parts[0];
      cmdArgs = [...parts.slice(1), ...args];
    }

    const proc = spawn(cmd, cmdArgs, spawnOptions);
    let output = '';
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`进程启动超时: ${command}\n输出: ${output.slice(-500)}`));
      }
    }, timeout);

    // 收集输出
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    // 错误处理
    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(error);
      }
    });

    // 提前退出处理
    proc.on('exit', (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error(`进程退出，代码: ${code}\n输出: ${output.slice(-500)}`));
      }
    });

    // 就绪检测
    const checkReady = async (): Promise<void> => {
      if (resolved) return;

      if (readyCheck) {
        try {
          const ready = await readyCheck();
          if (ready && !resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              process: proc,
              status: { running: true, pid: proc.pid },
              stop: async () => {
                await killProcess(proc);
              },
            });
          } else {
            setTimeout(checkReady, readyInterval);
          }
        } catch {
          setTimeout(checkReady, readyInterval);
        }
      } else {
        // 没有就绪检测，等待一段时间后认为就绪
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve({
              process: proc,
              status: { running: true, pid: proc.pid },
              stop: async () => {
                await killProcess(proc);
              },
            });
          }
        }, 2000);
      }
    };

    // 开始就绪检测
    setTimeout(checkReady, readyInterval);
  });
}

/**
 * 终止进程
 */
export async function killProcess(proc: ChildProcess): Promise<void> {
  if (!proc || proc.killed) return;

  return new Promise((resolve) => {
    try {
      // 先尝试优雅终止
      proc.kill('SIGTERM');

      // 等待进程退出
      const timeout = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
        resolve();
      }, 2000);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * 杀死占用指定端口的进程
 */
export async function killProcessOnPort(port: number): Promise<void> {
  try {
    // macOS/Linux
    await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
  } catch {
    // 忽略错误
  }

  // 等待进程完全退出
  await new Promise((r) => setTimeout(r, 500));
}

/**
 * 检查端口是否被占用
 */
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const net = require('node:net');
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}

/**
 * 等待端口可用
 */
export async function waitForPort(
  port: number,
  timeout = 30000,
  interval = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const inUse = await isPortInUse(port);
    if (inUse) {
      return true;
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  return false;
}

/**
 * 获取指定端口的进程 PID
 */
export async function getProcessOnPort(port: number): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pid = parseInt(stdout.trim().split('\n')[0], 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * 批量清理端口
 */
export async function cleanupPorts(ports: number[]): Promise<void> {
  await Promise.all(ports.map((port) => killProcessOnPort(port)));
}
