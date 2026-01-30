/**
 * Error Handle Grader - 错误处理能力评分器
 *
 * 验证：
 * 1. 服务器能处理无效 JSON
 * 2. 服务器能处理缺失字段
 * 3. 服务器能处理类型错误
 * 4. 服务器不会崩溃
 * 5. 返回合适的错误响应
 */

import type { ErrorHandleGraderConfig, GraderResult } from '../harness/types';
import type { IsolatedEnvironment } from '../harness/environment';
import { httpRequest, waitForPort, sleep } from './shared/http-utils';

/**
 * 测试用例结果
 */
interface TestCaseResult {
  name: string;
  passed: boolean;
  expectedStatus: number;
  actualStatus?: number;
  error?: string;
  responseBody?: unknown;
}

/**
 * 发送错误请求并检查响应
 */
async function sendErrorRequest(
  url: string,
  request: { body?: unknown; contentType?: string },
  expectedStatus: number
): Promise<TestCaseResult> {
  try {
    const headers: Record<string, string> = {};

    if (request.contentType) {
      headers['Content-Type'] = request.contentType;
    } else {
      headers['Content-Type'] = 'application/json';
    }

    // 处理请求体
    let body: string | undefined;
    if (request.body !== undefined) {
      if (typeof request.body === 'string') {
        body = request.body;
      } else {
        body = JSON.stringify(request.body);
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const responseBody = await response.text().catch(() => null);
    let parsedBody: unknown = responseBody;
    try {
      parsedBody = JSON.parse(responseBody || '');
    } catch {
      // 保持文本格式
    }

    // 检查状态码是否符合预期
    // 允许一定的灵活性：4xx 错误都算合理的错误处理
    const isExpectedError =
      (expectedStatus >= 400 && expectedStatus < 500 && response.status >= 400 && response.status < 500) ||
      response.status === expectedStatus;

    return {
      name: '',
      passed: isExpectedError,
      expectedStatus,
      actualStatus: response.status,
      responseBody: parsedBody,
    };
  } catch (error) {
    return {
      name: '',
      passed: false,
      expectedStatus,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 检查服务器是否仍在运行
 */
async function checkServerAlive(port: number): Promise<boolean> {
  try {
    const response = await httpRequest(`http://127.0.0.1:${port}`, {
      method: 'GET',
      timeout: 2000,
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

/**
 * 执行错误处理评分
 */
export async function gradeErrorHandle(
  projectDir: string,
  config: ErrorHandleGraderConfig,
  env: IsolatedEnvironment
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    totalCases: config.errorCases.length,
    passedCases: 0,
    failedCases: 0,
    serverCrashed: false,
    testResults: [],
  };

  const { errorCases, port, endpoint } = config;
  const url = `http://127.0.0.1:${port}${endpoint}`;

  try {
    // 先确保服务器在运行
    const serverReady = await waitForPort(port, '127.0.0.1', 5000, 500);
    if (!serverReady) {
      return {
        type: 'error-handle',
        passed: false,
        score: 0,
        details,
        error: '服务器未运行',
      };
    }

    const testResults: TestCaseResult[] = [];
    let passedCount = 0;

    // 执行每个测试用例
    for (const testCase of errorCases) {
      const result = await sendErrorRequest(url, testCase.request, testCase.expectStatus);
      result.name = testCase.name;
      testResults.push(result);

      if (result.passed) {
        passedCount++;
      }

      // 短暂延迟
      await sleep(100);

      // 检查服务器是否崩溃
      const stillAlive = await checkServerAlive(port);
      if (!stillAlive) {
        details.serverCrashed = true;
        details.crashedAfterCase = testCase.name;
        break;
      }
    }

    details.passedCases = passedCount;
    details.failedCases = testResults.length - passedCount;
    details.testResults = testResults;

    // 如果服务器崩溃，严重扣分
    if (details.serverCrashed) {
      return {
        type: 'error-handle',
        passed: false,
        score: 0.2,
        details,
        error: `服务器在测试 "${details.crashedAfterCase}" 后崩溃`,
      };
    }

    // 计算得分
    const score = errorCases.length > 0 ? passedCount / errorCases.length : 0;
    const passed = score >= 0.7;

    return {
      type: 'error-handle',
      passed,
      score,
      details,
      error: passed
        ? undefined
        : `${details.failedCases}/${errorCases.length} 个错误处理测试失败`,
    };
  } catch (error) {
    return {
      type: 'error-handle',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
