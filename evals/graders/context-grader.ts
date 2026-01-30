/**
 * Context Grader - 上下文复用评分器
 *
 * 验证：
 * 1. AI 能正确读取已存储的数据
 * 2. AI 的分析/统计结果正确
 */

import type { ContextGraderConfig, GraderResult } from '../harness/types';
import type { TranscriptRecorder } from '../harness/transcript';

/**
 * 检查响应是否包含预期答案
 */
function checkAnswer(
  response: string,
  expected: string | RegExp
): { matches: boolean; matchDetails?: string } {
  if (expected instanceof RegExp) {
    const match = response.match(expected);
    return {
      matches: !!match,
      matchDetails: match ? match[0] : undefined,
    };
  }

  // 字符串匹配（不区分大小写，允许部分匹配）
  const normalizedResponse = response.toLowerCase();
  const normalizedExpected = expected.toLowerCase();

  const matches = normalizedResponse.includes(normalizedExpected);

  return { matches };
}

/**
 * 从 Transcript 中提取助手响应
 */
function extractAssistantResponses(recorder: TranscriptRecorder): string[] {
  const entries = recorder.getEntries();
  const responses: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'assistant_message') {
      const content = entry.content as { text?: string };
      if (content.text) {
        responses.push(content.text);
      }
    }
  }

  return responses;
}

/**
 * 执行上下文复用评分
 */
export async function gradeContext(
  projectDir: string,
  config: ContextGraderConfig,
  recorder: TranscriptRecorder
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    responsesFound: 0,
    expectedAnswer: config.expectedAnswer instanceof RegExp
      ? config.expectedAnswer.source
      : config.expectedAnswer,
    answerFound: false,
    matchedResponse: undefined,
  };

  try {
    // 1. 提取助手响应
    const responses = extractAssistantResponses(recorder);
    details.responsesFound = responses.length;

    if (responses.length === 0) {
      return {
        type: 'context',
        passed: false,
        score: 0,
        details,
        error: '未找到助手响应',
      };
    }

    // 2. 确定要检查的响应
    const { expectedAnswer, responseIndex } = config;
    let targetResponse: string;

    if (responseIndex !== undefined && responseIndex < responses.length) {
      targetResponse = responses[responseIndex];
    } else {
      // 检查所有响应
      targetResponse = responses.join('\n');
    }

    details.targetResponse = targetResponse.slice(0, 500);

    // 3. 检查答案
    const answerCheck = checkAnswer(targetResponse, expectedAnswer);
    details.answerFound = answerCheck.matches;
    details.matchDetails = answerCheck.matchDetails;

    // 4. 计算得分
    const score = answerCheck.matches ? 1 : 0;

    return {
      type: 'context',
      passed: answerCheck.matches,
      score,
      details,
      error: answerCheck.matches ? undefined : '响应中未找到预期答案',
    };
  } catch (error) {
    return {
      type: 'context',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
