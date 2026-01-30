/**
 * AI Agent 客户端
 * 调用 AI API 执行代码生成任务
 */

import type { TranscriptRecorder } from './transcript';

// AI API 配置
const AI_API_URL = process.env.AI_API_URL || 'http://localhost:3000/api/ai-stream';

// 消息类型
export interface UIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 工具调用信息
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output?: string;
}

// AI 响应解析结果
export interface AIResponse {
  content: string;
  toolCalls: ToolCall[];
}

// 调用选项
export interface CallAIOptions {
  messages: UIMessage[];
  model?: string;
  timeout?: number;
  workspacePath?: string;  // 自定义工作目录（用于隔离环境）
}

/**
 * 调用 AI API 执行单轮对话
 */
export async function callAI(options: CallAIOptions): Promise<AIResponse> {
  const {
    messages,
    model = 'sonnet',
    timeout = 300000,
    workspacePath,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        workspacePath,  // 传递自定义工作目录
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API 调用失败: ${response.status} - ${error}`);
    }

    // 处理流式响应
    return await readStreamResponse(response);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 读取流式响应内容并收集工具调用
 */
async function readStreamResponse(response: Response): Promise<AIResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let content = '';
  let buffer = '';
  const toolCalls: ToolCall[] = [];
  const toolCallMap = new Map<string, ToolCall>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 解析 SSE 格式的流式数据
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        // 跳过空行
        if (!line.trim()) continue;

        // 处理 SSE data: 格式
        if (line.startsWith('data: ')) {
          // 跳过 [DONE] 标记
          if (line === 'data: [DONE]') continue;

          try {
            const data = JSON.parse(line.slice(6));

            // 处理文本增量
            if (data.type === 'text-delta' && data.delta) {
              content += data.delta;
            }

            // 处理工具调用输入
            if (data.type === 'tool-input-available') {
              const toolCall: ToolCall = {
                toolCallId: data.toolCallId,
                toolName: data.toolName,
                input: data.input || {},
              };
              toolCallMap.set(data.toolCallId, toolCall);
              console.log(`🔧 [Tool] ${data.toolName}: ${JSON.stringify(data.input).slice(0, 100)}...`);
            }

            // 处理工具调用输出
            if (data.type === 'tool-output-available') {
              const toolCall = toolCallMap.get(data.toolCallId);
              if (toolCall) {
                toolCall.output = data.output;
                console.log(`✅ [Tool] ${toolCall.toolName} 完成: ${String(data.output).slice(0, 100)}...`);
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
        // 兼容旧格式 (0: 前缀)
        else if (line.startsWith('0:')) {
          try {
            const text = JSON.parse(line.slice(2));
            if (typeof text === 'string') {
              content += text;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // 转换 Map 为数组
  toolCalls.push(...toolCallMap.values());

  return { content, toolCalls };
}

// Agent Turn 选项
export interface RunAgentTurnOptions {
  userMessage: string;
  previousMessages: UIMessage[];
  model: string;
  recorder: TranscriptRecorder;
  timeout: number;
  workspacePath?: string;  // 自定义工作目录（用于隔离环境）
}

// Agent Turn 结果
export interface AgentTurnResult {
  messages: UIMessage[];
  toolCalls: ToolCall[];
}

/**
 * 执行完整的 AI 对话（多轮）
 */
export async function runAgentTurn(options: RunAgentTurnOptions): Promise<AgentTurnResult> {
  const {
    userMessage,
    previousMessages,
    model,
    recorder,
    timeout,
    workspacePath,
  } = options;

  // 添加用户消息
  const messages: UIMessage[] = [
    ...previousMessages,
    { role: 'user', content: userMessage },
  ];

  // 记录用户消息
  recorder.recordUserMessage(userMessage);

  console.log(`🤖 [AI] 发送消息: "${userMessage.slice(0, 100)}..."`);

  try {
    // 调用 AI（传递工作目录以在隔离环境中执行）
    const response = await callAI({
      messages,
      model,
      timeout,
      workspacePath,
    });

    // 记录助手响应
    recorder.recordAssistantMessage(response.content);

    // 记录工具调用信息
    if (response.toolCalls.length > 0) {
      console.log(`🔧 [AI] 执行了 ${response.toolCalls.length} 个工具调用`);
      for (const toolCall of response.toolCalls) {
        recorder.recordToolCall(toolCall.toolName, toolCall.input, toolCall.output);
      }
    }

    console.log(`✅ [AI] 收到响应: ${response.content.length} 字符`);

    // 返回更新后的消息列表和工具调用
    return {
      messages: [
        ...messages,
        { role: 'assistant', content: response.content },
      ],
      toolCalls: response.toolCalls,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ [AI] 调用失败: ${errorMsg}`);
    recorder.recordError(new Error(errorMsg));

    // 即使失败也返回消息列表（不含助手响应）
    return {
      messages,
      toolCalls: [],
    };
  }
}

/**
 * 检查 AI API 是否可用
 */
export async function checkAIHealth(): Promise<boolean> {
  try {
    const response = await fetch(AI_API_URL.replace('/ai-stream', '/health'), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
