/**
 * 评估环境管理
 * 为每次评估创建隔离的运行环境
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { EvalConfig } from '../config';

export interface IsolatedEnvironment {
  /** 项目目录路径 */
  projectDir: string;
  /** 清理函数 */
  cleanup: () => Promise<void>;
  /** 运行的服务器进程列表 */
  serverProcesses: ChildProcess[];
}

/**
 * 创建隔离的评估环境
 */
export async function createIsolatedEnvironment(
  taskId: string,
  config: EvalConfig,
  setupScript?: string
): Promise<IsolatedEnvironment> {
  const timestamp = Date.now();
  const envDir = path.join(config.tempDirPrefix, `${taskId}-${timestamp}`);

  // 创建临时目录
  fs.mkdirSync(envDir, { recursive: true });

  // 复制 workspace 模板到临时目录
  const workspaceSource = path.join(process.cwd(), 'workspace');
  if (fs.existsSync(workspaceSource)) {
    copyDirSync(workspaceSource, envDir);
  } else {
    // 如果 workspace 不存在，创建基本结构
    fs.mkdirSync(path.join(envDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(envDir, 'data'), { recursive: true });
  }

  // 执行初始化脚本
  if (setupScript) {
    try {
      execSync(setupScript, {
        cwd: envDir,
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (error) {
      console.error(`Setup script failed for ${taskId}:`, error);
    }
  }

  const serverProcesses: ChildProcess[] = [];

  return {
    projectDir: envDir,
    serverProcesses,
    cleanup: async () => {
      // 终止所有服务器进程
      for (const proc of serverProcesses) {
        if (!proc.killed) {
          proc.kill('SIGTERM');
          // 等待进程退出
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }
      }

      // 删除临时目录
      if (fs.existsSync(envDir)) {
        fs.rmSync(envDir, { recursive: true, force: true });
      }
    },
  };
}

/**
 * 递归复制目录
 */
function copyDirSync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // 跳过 node_modules
    if (entry.name === 'node_modules') {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 列出项目文件
 */
export async function listProjectFiles(projectDir: string): Promise<string[]> {
  const files: string[] = [];

  function walkDir(dir: string, prefix = ''): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // 跳过 node_modules 和 .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walkDir(path.join(dir, entry.name), relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  walkDir(projectDir);
  return files;
}

/**
 * 收集代码内容（用于 LLM 评分）
 */
export async function collectCodeContent(projectDir: string): Promise<string> {
  const files = await listProjectFiles(projectDir);
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html'];

  let content = '';

  for (const file of files) {
    const ext = path.extname(file);
    if (!codeExtensions.includes(ext)) continue;

    const filePath = path.join(projectDir, file);
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      content += `\n\n// ========== ${file} ==========\n${fileContent}`;
    } catch {
      // 忽略读取失败的文件
    }
  }

  return content;
}

/**
 * 启动服务器进程
 */
export async function startServerProcess(
  projectDir: string,
  command: string,
  port: number,
  timeout = 30000
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let output = '';
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server startup timeout after ${timeout}ms`));
      }
    }, timeout);

    proc.stdout?.on('data', (data) => {
      output += data.toString();
      // 检查服务器是否已启动（监听端口）
      if (output.includes(`${port}`) || output.includes('listening')) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(proc);
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(error);
      }
    });

    proc.on('exit', (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error(`Server process exited with code ${code}: ${output}`));
      }
    });

    // 等待一小段时间后检查端口
    setTimeout(async () => {
      if (!resolved) {
        try {
          const isReady = await checkPort(port);
          if (isReady) {
            resolved = true;
            clearTimeout(timeoutId);
            resolve(proc);
          }
        } catch {
          // 继续等待
        }
      }
    }, 2000);
  });
}

/**
 * 检查端口是否可用
 */
async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('node:net');
    const client = new net.Socket();

    client.setTimeout(1000);

    client.on('connect', () => {
      client.destroy();
      resolve(true);
    });

    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });

    client.on('error', () => {
      client.destroy();
      resolve(false);
    });

    client.connect(port, '127.0.0.1');
  });
}
