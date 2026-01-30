/**
 * Server Grader - 服务器启动评分器
 *
 * 验证：
 * 1. 服务器文件是否存在
 * 2. 服务器是否能成功启动
 * 3. 指定端口是否响应
 * 4. 指定端点是否可访问
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { ServerGraderConfig, GraderResult } from '../harness/types';
import type { IsolatedEnvironment } from '../harness/environment';
import { httpRequest, waitForPort, sleep } from './shared/http-utils';

/**
 * 查找服务器入口文件
 */
function findServerFile(projectDir: string): string | null {
  const possibleFiles = [
    'server.ts',
    'server.js',
    'server/index.ts',
    'server/index.js',
    'src/server.ts',
    'src/server.js',
    'src/server/index.ts',
    'src/server/index.js',
    'behavior-server.ts',
    'behavior-server.js',
  ];

  for (const file of possibleFiles) {
    const filePath = path.join(projectDir, file);
    if (fs.existsSync(filePath)) {
      return file;
    }
  }

  return null;
}

/**
 * 启动服务器进程
 */
async function startServer(
  projectDir: string,
  command: string,
  port: number,
  timeout: number
): Promise<{ process: ChildProcess; success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port) },
      shell: true,
    });

    let output = '';
    let errorOutput = '';
    let resolved = false;

    const timeoutId = setTimeout(async () => {
      if (!resolved) {
        // 超时后检查端口
        const portReady = await checkPort(port);
        if (portReady) {
          resolved = true;
          resolve({ process: proc, success: true });
        } else {
          resolved = true;
          resolve({
            process: proc,
            success: false,
            error: `服务器启动超时 (${timeout}ms)，输出: ${output.slice(-500)}`,
          });
        }
      }
    }, timeout);

    proc.stdout?.on('data', (data) => {
      output += data.toString();
      // 检查是否已启动
      if (
        !resolved &&
        (output.includes(`${port}`) ||
          output.includes('listening') ||
          output.includes('started'))
      ) {
        checkAndResolve();
      }
    });

    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ process: proc, success: false, error: error.message });
      }
    });

    proc.on('exit', (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({
          process: proc,
          success: false,
          error: `服务器退出码 ${code}: ${errorOutput || output}`,
        });
      }
    });

    async function checkAndResolve() {
      await sleep(500);
      const portReady = await checkPort(port);
      if (portReady && !resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ process: proc, success: true });
      }
    }

    // 2秒后开始检查端口
    setTimeout(checkAndResolve, 2000);
  });
}

/**
 * 检查端口是否可用
 */
async function checkPort(port: number): Promise<boolean> {
  try {
    await httpRequest(`http://127.0.0.1:${port}`, { timeout: 2000 });
    return true;
  } catch {
    // 即使返回错误也说明端口已响应
    return false;
  }
}

/**
 * 测试端点
 */
async function testEndpoint(
  port: number,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const url = `http://127.0.0.1:${port}${endpoint}`;
    const response = await httpRequest(url, {
      method,
      body: method === 'POST' ? { test: true } : undefined,
      timeout: 5000,
    });

    // 2xx 或 4xx 都表示端点存在且响应
    if (response.status >= 200 && response.status < 500) {
      return { success: true, status: response.status };
    }

    return {
      success: false,
      status: response.status,
      error: `端点返回状态码 ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 执行服务器评分
 */
export async function gradeServer(
  projectDir: string,
  config: ServerGraderConfig,
  env: IsolatedEnvironment
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    serverFileFound: false,
    serverStarted: false,
    portResponding: false,
    endpointAccessible: false,
  };

  const { port, endpoint, timeout = 30000, method = 'POST', startCommand } = config;

  try {
    // 1. 查找服务器文件
    const serverFile = findServerFile(projectDir);
    details.serverFile = serverFile;
    details.serverFileFound = !!serverFile;

    if (!serverFile && !startCommand) {
      return {
        type: 'server',
        passed: false,
        score: 0,
        details,
        error: '未找到服务器入口文件',
      };
    }

    // 2. 确定启动命令
    const command = startCommand || `npx tsx ${serverFile}`;
    details.startCommand = command;

    // 3. 启动服务器
    const startResult = await startServer(projectDir, command, port, timeout);

    if (startResult.process) {
      env.serverProcesses.push(startResult.process);
    }

    details.serverStarted = startResult.success;
    if (!startResult.success) {
      return {
        type: 'server',
        passed: false,
        score: 0.25,
        details,
        error: startResult.error,
      };
    }

    // 4. 等待端口响应
    const portReady = await waitForPort(port, '127.0.0.1', 10000, 500);
    details.portResponding = portReady;

    if (!portReady) {
      return {
        type: 'server',
        passed: false,
        score: 0.5,
        details,
        error: `端口 ${port} 未响应`,
      };
    }

    // 5. 测试端点
    const endpointResult = await testEndpoint(port, endpoint, method);
    details.endpointAccessible = endpointResult.success;
    details.endpointStatus = endpointResult.status;

    if (!endpointResult.success) {
      return {
        type: 'server',
        passed: false,
        score: 0.75,
        details,
        error: endpointResult.error,
      };
    }

    return {
      type: 'server',
      passed: true,
      score: 1,
      details,
    };
  } catch (error) {
    return {
      type: 'server',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
