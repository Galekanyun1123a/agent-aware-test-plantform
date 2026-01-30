/**
 * LLM Grader - LLM 评分器
 *
 * 使用 LLM 基于 Rubric 进行代码质量评估
 */

import fs from 'node:fs';
import path from 'node:path';
import type { LLMGraderConfig, GraderResult } from '../harness/types';
import { collectCodeContent } from '../harness/environment';

/**
 * 读取 Rubric 文件
 */
function readRubric(rubricPath: string): string | null {
  const fullPath = path.join(process.cwd(), 'evals', 'rubrics', rubricPath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * 构建评估 Prompt
 */
function buildEvalPrompt(
  rubric: string,
  dimensions: string[],
  codeContent: string
): string {
  return `你是一个代码质量评估专家。请根据以下评分标准评估代码。

## 评分标准

${rubric}

## 评估维度

${dimensions.map((d) => `- ${d}`).join('\n')}

## 待评估代码

${codeContent.slice(0, 10000)}

## 输出格式

请以 JSON 格式返回评估结果：
{
  "dimensions": {
    "维度1": 0.8,
    "维度2": 0.9
  },
  "overall": 0.85,
  "reasoning": "评分理由..."
}

注意：
1. 每个维度分数在 0-1 之间
2. overall 是所有维度的加权平均
3. reasoning 请简要说明评分理由`;
}

/**
 * 模拟 LLM 评分（实际使用时替换为真实 API 调用）
 */
async function callLLM(prompt: string): Promise<{
  dimensions: Record<string, number>;
  overall: number;
  reasoning: string;
}> {
  // 这里是模拟实现
  // 实际使用时需要调用 OpenAI/Anthropic/Vertex AI 等 API

  // 基于代码长度和内容简单模拟评分
  const codeLength = prompt.length;
  const hasTypes = prompt.includes('interface') || prompt.includes('type ');
  const hasComments = prompt.includes('//') || prompt.includes('/*');
  const hasErrorHandling = prompt.includes('try') || prompt.includes('catch');

  let baseScore = 0.6;
  if (codeLength > 1000) baseScore += 0.1;
  if (hasTypes) baseScore += 0.1;
  if (hasComments) baseScore += 0.1;
  if (hasErrorHandling) baseScore += 0.1;

  baseScore = Math.min(baseScore, 1);

  return {
    dimensions: {
      '代码质量': baseScore,
      '功能完整性': baseScore - 0.05,
      '错误处理': hasErrorHandling ? baseScore : baseScore - 0.2,
    },
    overall: baseScore,
    reasoning: `代码长度 ${codeLength}，${hasTypes ? '有' : '无'}类型定义，${hasComments ? '有' : '无'}注释，${hasErrorHandling ? '有' : '无'}错误处理`,
  };
}

/**
 * 执行 LLM 评分
 */
export async function gradeLLM(
  projectDir: string,
  config: LLMGraderConfig
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    rubricLoaded: false,
    codeCollected: false,
    llmCalled: false,
    dimensions: {},
    overall: 0,
    reasoning: '',
  };

  const { rubric, dimensions, threshold = 0.7 } = config;

  try {
    // 1. 读取 Rubric
    const rubricContent = readRubric(rubric);
    details.rubricLoaded = !!rubricContent;

    if (!rubricContent) {
      return {
        type: 'llm',
        passed: false,
        score: 0,
        details,
        error: `无法读取 Rubric 文件: ${rubric}`,
      };
    }

    // 2. 收集代码内容
    const codeContent = await collectCodeContent(projectDir);
    details.codeCollected = true;
    details.codeLength = codeContent.length;

    if (codeContent.length < 100) {
      return {
        type: 'llm',
        passed: false,
        score: 0,
        details,
        error: '代码内容过少，无法评估',
      };
    }

    // 3. 构建 Prompt 并调用 LLM
    const prompt = buildEvalPrompt(rubricContent, dimensions, codeContent);
    const llmResult = await callLLM(prompt);
    details.llmCalled = true;

    // 4. 解析结果
    details.dimensions = llmResult.dimensions;
    details.overall = llmResult.overall;
    details.reasoning = llmResult.reasoning;

    // 5. 计算是否通过
    const passed = llmResult.overall >= threshold;

    return {
      type: 'llm',
      passed,
      score: llmResult.overall,
      details,
      error: passed ? undefined : `评分 ${(llmResult.overall * 100).toFixed(0)}% 低于阈值 ${(threshold * 100).toFixed(0)}%`,
    };
  } catch (error) {
    return {
      type: 'llm',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
