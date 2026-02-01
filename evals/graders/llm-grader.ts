/**
 * LLM Grader - LLM 评分器
 *
 * 使用 LLM 基于 Rubric 进行代码质量评估
 * 支持多种后端：
 * - 模拟模式（默认）：基于代码特征进行启发式评分
 * - OpenAI API：使用 GPT-4 进行评估
 * - Anthropic API：使用 Claude 进行评估
 * 
 * 通过环境变量 EVAL_LLM_BACKEND 控制：
 * - 'mock' (默认)：使用模拟评分
 * - 'openai'：使用 OpenAI GPT-4
 * - 'anthropic'：使用 Anthropic Claude
 */

import fs from 'node:fs';
import path from 'node:path';
import type { LLMGraderConfig, GraderResult } from '../harness/types';
import { collectCodeContent } from '../harness/environment';

// LLM 评分结果类型
interface LLMGradingResult {
  dimensions: Record<string, number>;
  overall: number;
  reasoning: string;
}

// 获取 LLM 后端配置
const LLM_BACKEND = process.env.EVAL_LLM_BACKEND || 'mock';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
  // 限制代码长度，避免超出 token 限制
  const maxCodeLength = 15000;
  const truncatedCode = codeContent.length > maxCodeLength 
    ? codeContent.slice(0, maxCodeLength) + '\n\n... (代码已截断)'
    : codeContent;

  return `你是一个代码质量评估专家。请根据以下评分标准评估代码。

## 评分标准

${rubric}

## 评估维度

${dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## 待评估代码

\`\`\`
${truncatedCode}
\`\`\`

## 输出格式

请严格按照以下 JSON 格式返回评估结果，不要包含任何其他内容：
{
  "dimensions": {
    "${dimensions[0]}": 0.8${dimensions.length > 1 ? `,\n    "${dimensions[1]}": 0.9` : ''}
  },
  "overall": 0.85,
  "reasoning": "评分理由..."
}

注意：
1. 每个维度分数在 0-1 之间
2. overall 是所有维度的加权平均
3. reasoning 请简要说明评分理由（使用中文）`;
}

/**
 * 使用 OpenAI API 调用 LLM
 */
async function callOpenAI(prompt: string): Promise<LLMGradingResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 未配置');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API 调用失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('OpenAI 返回空响应');
  }

  return parseJsonResponse(content);
}

/**
 * 使用 Anthropic API 调用 LLM
 */
async function callAnthropic(prompt: string): Promise<LLMGradingResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 未配置');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API 调用失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  
  if (!content) {
    throw new Error('Anthropic 返回空响应');
  }

  return parseJsonResponse(content);
}

/**
 * 解析 JSON 响应
 */
function parseJsonResponse(text: string): LLMGradingResult {
  // 尝试提取 JSON 部分
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('响应中未找到 JSON 格式内容');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  // 验证必要字段
  if (typeof parsed.overall !== 'number' || !parsed.dimensions || !parsed.reasoning) {
    throw new Error('JSON 格式不完整，缺少必要字段');
  }

  return {
    dimensions: parsed.dimensions,
    overall: Math.max(0, Math.min(1, parsed.overall)),
    reasoning: parsed.reasoning,
  };
}

/**
 * 模拟 LLM 评分（基于代码特征的启发式评分）
 * 用于测试评估框架或无 API 密钥时的后备方案
 */
async function callMockLLM(prompt: string, dimensions: string[]): Promise<LLMGradingResult> {
  // 基于代码内容进行启发式评分
  const codeLength = prompt.length;
  const hasTypes = prompt.includes('interface') || prompt.includes('type ');
  const hasComments = prompt.includes('//') || prompt.includes('/*');
  const hasErrorHandling = prompt.includes('try') || prompt.includes('catch');
  const hasAgentAware = prompt.includes('agent-aware') || prompt.includes('initAgentAware');
  const hasTailwind = prompt.includes('className') || prompt.includes('tailwind');
  const hasReact = prompt.includes('React') || prompt.includes('useState') || prompt.includes('useEffect');

  // 计算基础分数
  let baseScore = 0.5;
  
  // 代码量评分
  if (codeLength > 500) baseScore += 0.05;
  if (codeLength > 1000) baseScore += 0.05;
  if (codeLength > 2000) baseScore += 0.05;
  
  // 代码质量评分
  if (hasTypes) baseScore += 0.1;
  if (hasComments) baseScore += 0.05;
  if (hasErrorHandling) baseScore += 0.1;
  
  // Agent-Aware 集成评分
  if (hasAgentAware) baseScore += 0.15;
  
  // UI 实现评分
  if (hasTailwind) baseScore += 0.05;
  if (hasReact) baseScore += 0.05;

  baseScore = Math.min(baseScore, 1);

  // 为每个维度生成评分
  const dimensionScores: Record<string, number> = {};
  const reasoning: string[] = [];

  for (const dim of dimensions) {
    let score = baseScore;
    
    // 根据维度调整分数
    if (dim.includes('依赖') || dim.includes('集成')) {
      score = hasAgentAware ? Math.min(score + 0.1, 1) : Math.max(score - 0.2, 0);
      reasoning.push(hasAgentAware ? 'agent-aware 已集成' : 'agent-aware 未集成');
    } else if (dim.includes('代码质量') || dim.includes('代码结构')) {
      score = hasTypes ? Math.min(score + 0.05, 1) : score;
      score = hasComments ? Math.min(score + 0.05, 1) : Math.max(score - 0.1, 0);
    } else if (dim.includes('错误处理') || dim.includes('错误')) {
      score = hasErrorHandling ? Math.min(score + 0.1, 1) : Math.max(score - 0.15, 0);
    } else if (dim.includes('UI') || dim.includes('样式')) {
      score = hasTailwind ? Math.min(score + 0.1, 1) : Math.max(score - 0.1, 0);
    } else if (dim.includes('初始化')) {
      score = hasAgentAware ? Math.min(score + 0.15, 1) : Math.max(score - 0.3, 0);
    }
    
    dimensionScores[dim] = Math.round(score * 100) / 100;
  }

  // 计算总分
  const scores = Object.values(dimensionScores);
  const overall = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    dimensions: dimensionScores,
    overall: Math.round(overall * 100) / 100,
    reasoning: `[模拟评分] 代码长度 ${codeLength} 字符，${reasoning.join('；')}，${hasTypes ? '有' : '无'}类型定义，${hasComments ? '有' : '无'}注释，${hasErrorHandling ? '有' : '无'}错误处理`,
  };
}

/**
 * 调用 LLM 进行评分
 */
async function callLLM(prompt: string, dimensions: string[]): Promise<LLMGradingResult> {
  switch (LLM_BACKEND) {
    case 'openai':
      console.log('🤖 [LLM Grader] 使用 OpenAI GPT-4 进行评估');
      return await callOpenAI(prompt);
    
    case 'anthropic':
      console.log('🤖 [LLM Grader] 使用 Anthropic Claude 进行评估');
      return await callAnthropic(prompt);
    
    case 'mock':
    default:
      console.log('🤖 [LLM Grader] 使用模拟评分（设置 EVAL_LLM_BACKEND=openai|anthropic 启用真实评估）');
      return await callMockLLM(prompt, dimensions);
  }
}

/**
 * 执行 LLM 评分
 * 
 * @param projectDir 项目目录
 * @param config LLM 评分器配置
 * @param codeContent 可选的代码内容（如果已收集）
 */
export async function gradeLLM(
  projectDir: string,
  config: LLMGraderConfig,
  codeContent?: string
): Promise<GraderResult> {
  const details: Record<string, unknown> = {
    rubricLoaded: false,
    codeCollected: false,
    llmCalled: false,
    llmBackend: LLM_BACKEND,
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
      // Rubric 文件不存在时，使用默认评分标准
      console.warn(`⚠️ [LLM Grader] Rubric 文件不存在: ${rubric}，使用默认评分标准`);
      const defaultRubric = `
## 通用代码质量评分标准

### 评估维度
${dimensions.map(d => `- ${d}`).join('\n')}

### 评分规则
- 1.0 分：完全符合要求，代码质量优秀
- 0.7 分：基本符合要求，有小问题
- 0.5 分：部分符合要求，有明显问题
- 0.3 分：不符合要求，存在严重问题
- 0.0 分：完全不符合要求
      `;
      details.rubricLoaded = true;
      details.usingDefaultRubric = true;
    }

    // 2. 收集代码内容（如果未提供）
    let code = codeContent;
    if (!code) {
      code = await collectCodeContent(projectDir);
    }
    details.codeCollected = true;
    details.codeLength = code.length;

    if (code.length < 50) {
      return {
        type: 'llm',
        passed: false,
        score: 0,
        details,
        error: '代码内容过少，无法评估',
      };
    }

    // 3. 构建 Prompt 并调用 LLM
    const effectiveRubric = rubricContent || `通用代码质量评分标准，评估维度: ${dimensions.join(', ')}`;
    const prompt = buildEvalPrompt(effectiveRubric, dimensions, code);
    
    console.log(`📝 [LLM Grader] 评估维度: ${dimensions.join(', ')}`);
    console.log(`📏 [LLM Grader] 代码长度: ${code.length} 字符`);
    
    const llmResult = await callLLM(prompt, dimensions);
    details.llmCalled = true;

    // 4. 解析结果
    details.dimensions = llmResult.dimensions;
    details.overall = llmResult.overall;
    details.reasoning = llmResult.reasoning;

    // 5. 计算是否通过
    const passed = llmResult.overall >= threshold;

    console.log(`🎯 [LLM Grader] 评分: ${(llmResult.overall * 100).toFixed(0)}%，阈值: ${(threshold * 100).toFixed(0)}%，${passed ? '✅ 通过' : '❌ 未通过'}`);

    return {
      type: 'llm',
      passed,
      score: llmResult.overall,
      details,
      error: passed ? undefined : `评分 ${(llmResult.overall * 100).toFixed(0)}% 低于阈值 ${(threshold * 100).toFixed(0)}%`,
    };
  } catch (error) {
    console.error(`❌ [LLM Grader] 评分失败:`, error);
    return {
      type: 'llm',
      passed: false,
      score: 0,
      details,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
