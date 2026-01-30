/**
 * Runtime Grader - 运行时评分器
 *
 * 使用 Playwright 进行浏览器自动化测试：
 * 1. 启动开发服务器
 * 2. 打开浏览器访问页面
 * 3. 检查页面加载状态
 * 4. 收集控制台错误
 * 5. 验证预期内容
 */

import { chromium, type Browser, type Page, type ConsoleMessage } from 'playwright';
import { spawn, exec, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { GraderResult } from '../harness/types';

// Runtime Grader 配置
export interface RuntimeGraderConfig {
  type: 'runtime';
  /** 开发服务器端口 */
  port: number;
  /** 页面加载超时（毫秒） */
  timeout?: number;
  /** 期望页面包含的文本 */
  expectText?: string | string[];
  /** 期望页面包含的元素选择器 */
  expectSelector?: string | string[];
  /** 启动命令 */
  startCommand?: string;
}

// 页面检查结果
interface PageCheckResult {
  pageLoaded: boolean;
  title: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  snapshot?: string;
  textFound?: boolean;
  selectorFound?: boolean;
}

/**
 * 清理端口占用
 */
async function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, () => {
      // 忽略错误（可能没有进程占用）
      resolve();
    });
  });
}

/**
 * 等待端口可用
 */
async function waitForPort(
  port: number,
  timeout: number = 30000,
  interval: number = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // 继续等待
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  return false;
}

/**
 * 启动开发服务器
 */
async function startDevServer(
  projectDir: string,
  port: number,
  command?: string,
  timeout: number = 60000
): Promise<ChildProcess> {
  const startCommand = command || 'pnpm dev';
  const [cmd, ...args] = startCommand.split(' ');

  console.log(`🚀 [Runtime] 启动开发服务器: ${startCommand} (端口: ${port})`);

  const proc = spawn(cmd, args, {
    cwd: projectDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      VITE_PORT: String(port),
    },
    shell: true,
    detached: false,
  });

  let output = '';

  proc.stdout?.on('data', (data) => {
    output += data.toString();
  });

  proc.stderr?.on('data', (data) => {
    output += data.toString();
  });

  // 等待服务器启动
  const ready = await waitForPort(port, timeout);

  if (!ready) {
    proc.kill();
    throw new Error(`开发服务器启动超时，输出: ${output.slice(-500)}`);
  }

  console.log(`✅ [Runtime] 开发服务器已启动`);

  return proc;
}

/**
 * 使用 Playwright 检查页面
 */
async function checkPage(
  port: number,
  timeout: number,
  expectText?: string | string[],
  expectSelector?: string | string[]
): Promise<PageCheckResult> {
  let browser: Browser | undefined;
  let page: Page | undefined;

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  try {
    // 启动浏览器
    browser = await chromium.launch({
      headless: true,
    });

    page = await browser.newPage();

    // 收集控制台消息
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        consoleErrors.push(text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // 收集页面错误
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // 访问页面
    const url = `http://localhost:${port}`;
    console.log(`🌐 [Runtime] 访问页面: ${url}`);

    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

    if (!response || !response.ok()) {
      return {
        pageLoaded: false,
        title: '',
        consoleErrors,
        consoleWarnings,
      };
    }

    // 等待页面内容加载
    await page.waitForTimeout(1000);

    // 获取页面标题
    const title = await page.title();

    // 获取页面快照（文本内容）
    const snapshot = await page.evaluate(() => document.body.innerText);

    // 检查预期文本
    let textFound = true;
    if (expectText) {
      const texts = Array.isArray(expectText) ? expectText : [expectText];
      textFound = texts.every((text) =>
        snapshot.toLowerCase().includes(text.toLowerCase())
      );
    }

    // 检查预期选择器
    let selectorFound = true;
    if (expectSelector) {
      const selectors = Array.isArray(expectSelector) ? expectSelector : [expectSelector];
      for (const selector of selectors) {
        const element = await page.$(selector);
        if (!element) {
          selectorFound = false;
          break;
        }
      }
    }

    console.log(`✅ [Runtime] 页面加载成功: "${title}"`);
    if (consoleErrors.length > 0) {
      console.log(`⚠️ [Runtime] 控制台错误: ${consoleErrors.length} 个`);
    }

    return {
      pageLoaded: true,
      title,
      consoleErrors,
      consoleWarnings,
      snapshot: snapshot.slice(0, 1000),
      textFound,
      selectorFound,
    };
  } catch (error) {
    console.error(`❌ [Runtime] 页面检查失败: ${error}`);
    return {
      pageLoaded: false,
      title: '',
      consoleErrors: [error instanceof Error ? error.message : String(error)],
      consoleWarnings,
    };
  } finally {
    await page?.close();
    await browser?.close();
  }
}

/**
 * 模拟用户交互
 */
export async function simulateUserInteraction(
  port: number,
  actions: Array<{
    type: 'click' | 'type' | 'wait';
    selector?: string;
    value?: string;
    timeout?: number;
  }>,
  timeout: number = 30000
): Promise<{
  success: boolean;
  errors: string[];
  screenshots?: string[];
}> {
  let browser: Browser | undefined;
  let page: Page | undefined;
  const errors: string[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // 访问页面
    await page.goto(`http://localhost:${port}`, {
      waitUntil: 'networkidle',
      timeout,
    });

    // 执行用户操作
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'click':
            if (action.selector) {
              await page.click(action.selector, { timeout: action.timeout || 5000 });
              console.log(`🖱️ [Runtime] 点击: ${action.selector}`);
            }
            break;

          case 'type':
            if (action.selector && action.value) {
              await page.fill(action.selector, action.value);
              console.log(`⌨️ [Runtime] 输入: ${action.selector} = "${action.value}"`);
            }
            break;

          case 'wait':
            await page.waitForTimeout(action.timeout || 1000);
            break;
        }
      } catch (error) {
        errors.push(`操作失败 (${action.type}): ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  } finally {
    await page?.close();
    await browser?.close();
  }
}

/**
 * 执行运行时评分
 */
export async function gradeRuntime(
  projectDir: string,
  config: RuntimeGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    pageLoaded: false,
    consoleErrors: [],
    hasErrors: false,
  };

  const { port, timeout = 30000, expectText, expectSelector, startCommand } = config;

  let server: ChildProcess | undefined;

  try {
    // 1. 清理端口
    await killProcessOnPort(port);

    // 2. 检查项目是否存在
    const packageJsonPath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return {
        type: 'runtime',
        passed: false,
        score: 0,
        details: { ...details, error: 'package.json 不存在' },
        error: '项目不存在',
      };
    }

    // 3. 安装依赖（如果需要）
    const nodeModulesPath = path.join(projectDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(`📦 [Runtime] 安装依赖...`);
      await new Promise<void>((resolve, reject) => {
        exec('pnpm install', { cwd: projectDir }, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    // 4. 启动开发服务器
    server = await startDevServer(projectDir, port, startCommand, 60000);

    // 5. 检查页面
    const checkResult = await checkPage(port, timeout, expectText, expectSelector);

    details.pageLoaded = checkResult.pageLoaded;
    details.title = checkResult.title;
    details.consoleErrors = checkResult.consoleErrors;
    details.consoleWarnings = checkResult.consoleWarnings;
    details.snapshot = checkResult.snapshot;
    details.textFound = checkResult.textFound;
    details.selectorFound = checkResult.selectorFound;

    // 6. 计算分数
    const hasErrors = checkResult.consoleErrors.length > 0;
    details.hasErrors = hasErrors;

    let score = 0;
    if (checkResult.pageLoaded) {
      score = hasErrors ? 0.5 : 1;

      // 如果有预期文本/选择器检查，影响分数
      if (expectText && !checkResult.textFound) {
        score *= 0.8;
      }
      if (expectSelector && !checkResult.selectorFound) {
        score *= 0.8;
      }
    }

    const passed = checkResult.pageLoaded && !hasErrors;

    return {
      type: 'runtime',
      passed,
      score,
      details,
      error: hasErrors ? `控制台错误: ${checkResult.consoleErrors.join('; ')}` : undefined,
    };
  } catch (error) {
    return {
      type: 'runtime',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // 清理：停止服务器
    if (server) {
      server.kill();
      await killProcessOnPort(port);
    }
  }
}
