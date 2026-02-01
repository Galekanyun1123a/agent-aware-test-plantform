/**
 * Runtime Grader - 运行时评分器
 *
 * 使用 Playwright 进行浏览器自动化测试：
 * 1. 启动开发服务器
 * 2. 打开浏览器访问页面
 * 3. 检查页面加载状态
 * 4. 收集控制台错误
 * 5. 验证预期内容
 * 6. 模拟用户行为（点击、输入等）
 * 7. 等待 agent-aware 检测文件生成
 *
 * 增强功能（对应 getSystemPrompt）：
 * - 支持用户行为模拟触发 agent-aware 检测
 * - 支持等待 .agent-aware/ 目录下的检测文件
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
  /** 用户行为模拟操作 */
  userActions?: Array<{
    type: 'click' | 'type' | 'wait' | 'scroll' | 'rage_click' | 'dead_click';
    selector?: string;
    value?: string;
    timeout?: number;
    count?: number; // 用于 rage_click/dead_click 次数
  }>;
  /** 是否等待 agent-aware 检测文件 */
  waitForAgentAware?: boolean;
  /** 等待的检测文件类型 */
  waitForAgentAwareFile?: 'behavior.json' | 'error.json' | 'both';
  /** 等待检测文件的超时时间 */
  agentAwareTimeout?: number;
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
 * 增强版：支持 rage_click（愤怒点击）和 dead_click（死点击）模拟
 */
export async function simulateUserInteraction(
  port: number,
  actions: Array<{
    type: 'click' | 'type' | 'wait' | 'scroll' | 'rage_click' | 'dead_click';
    selector?: string;
    value?: string;
    timeout?: number;
    count?: number;
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

          case 'scroll':
            if (action.selector) {
              await page.locator(action.selector).scrollIntoViewIfNeeded();
            } else {
              await page.evaluate(() => window.scrollBy(0, 300));
            }
            console.log(`📜 [Runtime] 滚动`);
            break;

          case 'rage_click':
            // 模拟愤怒点击：快速连续点击
            {
              const clickCount = action.count || 5;
              const selector = action.selector || 'body';
              console.log(`😤 [Runtime] 模拟愤怒点击: ${selector} x${clickCount}`);
              for (let i = 0; i < clickCount; i++) {
                await page.click(selector, { delay: 50 });
              }
            }
            break;

          case 'dead_click':
            // 模拟死点击：点击无响应元素
            {
              const clickCount = action.count || 3;
              // 尝试点击一个不存在的元素或静态元素
              const selector = action.selector || 'div.static-element, span:not([onclick])';
              console.log(`💀 [Runtime] 模拟死点击: ${selector} x${clickCount}`);
              try {
                for (let i = 0; i < clickCount; i++) {
                  // 点击页面上的静态位置
                  await page.mouse.click(100 + i * 10, 100 + i * 10);
                  await page.waitForTimeout(100);
                }
              } catch {
                // 忽略点击错误
              }
            }
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
 * 等待 agent-aware 检测文件生成
 */
async function waitForAgentAwareFile(
  projectDir: string,
  fileType: 'behavior.json' | 'error.json' | 'both',
  timeout: number = 10000
): Promise<{ found: boolean; files: string[] }> {
  const startTime = Date.now();
  const agentAwareDir = path.join(projectDir, '.agent-aware');
  const foundFiles: string[] = [];

  const filesToCheck = fileType === 'both'
    ? ['behavior.json', 'error.json']
    : [fileType];

  while (Date.now() - startTime < timeout) {
    for (const file of filesToCheck) {
      const filePath = path.join(agentAwareDir, file);
      if (fs.existsSync(filePath) && !foundFiles.includes(file)) {
        foundFiles.push(file);
        console.log(`✅ [AgentAware] 检测到文件: ${file}`);
      }
    }

    // 如果所有文件都找到了，返回
    if (foundFiles.length === filesToCheck.length) {
      return { found: true, files: foundFiles };
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return { found: foundFiles.length > 0, files: foundFiles };
}

/**
 * 执行运行时评分
 * 增强版：支持用户行为模拟和 agent-aware 检测文件等待
 */
export async function gradeRuntime(
  projectDir: string,
  config: RuntimeGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    pageLoaded: false,
    consoleErrors: [],
    hasErrors: false,
    userActionsExecuted: false,
    agentAwareFiles: [],
  };

  const {
    port,
    timeout = 30000,
    expectText,
    expectSelector,
    startCommand,
    userActions,
    waitForAgentAware,
    waitForAgentAwareFile = 'behavior.json',
    agentAwareTimeout = 10000,
  } = config;

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

    // 6. 执行用户行为模拟（如果配置了）
    if (userActions && userActions.length > 0) {
      console.log(`🎭 [Runtime] 执行用户行为模拟...`);
      const interactionResult = await simulateUserInteraction(port, userActions, timeout);
      details.userActionsExecuted = true;
      details.userActionsSuccess = interactionResult.success;
      details.userActionsErrors = interactionResult.errors;

      // 等待一小段时间让 agent-aware 处理行为数据
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 7. 等待 agent-aware 检测文件（如果配置了）
    if (waitForAgentAware) {
      console.log(`🔍 [Runtime] 等待 agent-aware 检测文件...`);
      const agentAwareResult = await waitForAgentAwareFile(
        projectDir,
        waitForAgentAwareFile,
        agentAwareTimeout
      );
      details.agentAwareFound = agentAwareResult.found;
      details.agentAwareFiles = agentAwareResult.files;
    }

    // 8. 计算分数
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

      // 用户行为模拟成功加分
      if (userActions && details.userActionsSuccess) {
        score = Math.min(1, score * 1.1);
      }

      // 检测到 agent-aware 文件加分
      if (waitForAgentAware && details.agentAwareFound) {
        score = Math.min(1, score * 1.1);
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
