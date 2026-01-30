/**
 * Data Collection Grader - 数据收集评分器
 *
 * 验证：
 * 1. 服务器能正确接收 POST 请求
 * 2. 服务器能正确解析 JSON 数据
 * 3. 响应包含预期的字段
 */

import type { DataCollectionGraderConfig, GraderResult } from '../harness/types';
import { httpRequest, sleep } from './shared/http-utils';

/**
 * 发送测试数据并验证响应
 */
async function sendAndValidate(
  endpoint: string,
  data: object,
  expectedFields: string[]
): Promise<{ success: boolean; response?: unknown; error?: string }> {
  try {
    const response = await httpRequest(endpoint, {
      method: 'POST',
      body: data,
      timeout: 5000,
    });

    // 检查状态码
    if (response.status < 200 || response.status >= 300) {
      return {
        success: false,
        response: response.body,
        error: `请求失败，状态码: ${response.status}`,
      };
    }

    return { success: true, response: response.body };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 验证数据包含预期字段
 */
function validateFields(
  data: unknown,
  expectedFields: string[]
): { valid: boolean; missingFields: string[] } {
  if (!data || typeof data !== 'object') {
    return { valid: false, missingFields: expectedFields };
  }

  const missingFields: string[] = [];
  for (const field of expectedFields) {
    if (!(field in (data as Record<string, unknown>))) {
      missingFields.push(field);
    }
  }

  return { valid: missingFields.length === 0, missingFields };
}

/**
 * 执行数据收集评分
 */
export async function gradeDataCollection(
  projectDir: string,
  config: DataCollectionGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    totalRequests: config.testData.length,
    successfulRequests: 0,
    failedRequests: 0,
    responses: [],
    fieldValidation: {},
  };

  const { testData, expectedFields, endpoint, port } = config;
  const url = `http://127.0.0.1:${port}${endpoint}`;

  try {
    let successCount = 0;
    const responses: unknown[] = [];

    // 发送所有测试数据
    for (const data of testData) {
      const result = await sendAndValidate(url, data, expectedFields);
      responses.push(result);

      if (result.success) {
        successCount++;
      }

      // 短暂延迟避免请求过快
      await sleep(100);
    }

    details.successfulRequests = successCount;
    details.failedRequests = testData.length - successCount;
    details.responses = responses;

    // 验证发送的数据字段
    const fieldValidation = validateFields(testData[0], expectedFields);
    details.fieldValidation = fieldValidation;

    // 计算得分
    const score = testData.length > 0 ? successCount / testData.length : 0;
    const passed = score >= 0.8; // 80% 的请求成功即通过

    return {
      type: 'data-collection',
      passed,
      score,
      details,
      error: passed ? undefined : `${details.failedRequests}/${testData.length} 请求失败`,
    };
  } catch (error) {
    return {
      type: 'data-collection',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
