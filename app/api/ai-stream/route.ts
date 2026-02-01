/**
 * AI 流式对话 API
 * 使用 Claude Code 处理用户消息并返回流式响应
 */

import { streamText, type CoreMessage } from 'ai';
import { claudeCodeProvider, getDefaultModel } from '@/lib/claude-code-provider';

// 允许流式响应最长持续 300 秒
export const maxDuration = 300;

// 获取工作目录路径（使用项目目录下的 workspace 文件夹）
function getWorkspacePath(customPath?: string): string {
  // 优先使用请求中的自定义路径（用于评估系统隔离环境）
  if (customPath) {
    return customPath;
  }
  if (process.env.WORKSPACE_PATH) {
    return process.env.WORKSPACE_PATH;
  }
  return process.cwd() + '/workspace';
}

// 生成系统提示
function getSystemPrompt(customWorkspacePath?: string): string {
  const workspacePath = getWorkspacePath(customWorkspacePath);
  return `你是一个web开发工程师，擅长前端开发。

## 工作环境
- 工作目录: ${workspacePath}
- 这是一个 Vite + React + TypeScript 项目
- 主要入口文件: src/App.tsx
- 样式文件: src/index.css (使用 Tailwind CSS v4，导入方式: @import "tailwindcss")

## 项目结构
\`\`\`
${workspacePath}/
├── src/
│   ├── App.tsx      # 主组件 - 在这里编写页面内容
│   ├── main.tsx     # 入口文件（需要初始化 agent-aware）
│   └── index.css    # 全局样式
├── index.html       # HTML 模板
└── package.json
\`\`\`

## 必须集成 Agent-Aware 用户行为追踪

**重要**: 每次创建或修改项目时，必须确保集成 @reskill/agent-aware 库来追踪用户行为。

### 1. 安装依赖（如果尚未安装）
在 ${workspacePath} 目录执行:
\`\`\`bash
pnpm add @reskill/agent-aware
\`\`\`

### 2. 在应用入口初始化
在 src/main.tsx 文件中，在 React 渲染之前初始化:

\`\`\`typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAgentAware } from '@reskill/agent-aware'
import './index.css'
import App from './App'

// 初始化 Agent-Aware 用户行为追踪
initAgentAware()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
\`\`\`

## Agent-Aware Server 智能检测

@reskill/agent-aware-server 是服务端组件，用于接收客户端上报的用户行为数据，并通过智能检测器主动发现问题。

### 1. 安装 Agent-Aware Server
在 ${workspacePath} 目录执行:
\`\`\`bash
pnpm add @reskill/agent-aware-server
\`\`\`

### 2. 启动 Agent-Aware Server
安装后，在 ${workspacePath} 目录启动服务:
\`\`\`bash
npx agent-aware-server
\`\`\`
默认监听端口为 4100，可通过 --port 参数指定其他端口。

### 检测文件位置
检测结果输出到 \`${workspacePath}/.agent-aware/\` 目录：
- \`.agent-aware/behavior.json\` - 行为检测结果（用户挫折、愤怒点击、死点击）
- \`.agent-aware/error.json\` - 错误检测结果（运行时错误、Promise 异常、Console 错误）

### 检测触发条件

**行为检测器 (BehaviorDetector)**：
- Critical（严重）：挫折指数 >= 70
- Warning（警告）：挫折指数 50-70、愤怒点击 >= 3 次、死点击 >= 2 次

**错误检测器 (AlertDetector)**：
- Critical（严重）：错误数 >= 1

### 检测文件格式示例

behavior.json:
\`\`\`json
{
  "timestamp": "2026-01-30T10:30:00.000Z",
  "severity": "critical",
  "type": "frustration",
  "summary": "检测到用户挫折行为",
  "details": {
    "frustrationScore": 75,
    "rageClickCount": 5,
    "deadClickCount": 3
  }
}
\`\`\`

error.json:
\`\`\`json
{
  "timestamp": "2026-01-30T10:30:00.000Z",
  "severity": "critical",
  "type": "error",
  "summary": "检测到 3 个运行时错误",
  "details": {
    "totalErrors": 3,
    "recentErrors": [{"message": "Cannot read property 'foo' of undefined"}]
  }
}
\`\`\`

### 主动发现问题
**重要**：当用户在使用生成的页面时，你应该主动读取 \`.agent-aware/\` 目录下的检测文件，发现用户遇到的问题并主动修复：
1. 读取 \`${workspacePath}/.agent-aware/behavior.json\` 检查用户行为问题
2. 读取 \`${workspacePath}/.agent-aware/error.json\` 检查运行时错误
3. 根据检测结果主动提出修复建议或直接修复代码

## 你的任务
当用户要求创建页面或组件时：
1. **首先检查并安装 @reskill/agent-aware 依赖**
2. **确保 src/main.tsx 中已初始化 initAgentAware()**
3. 修改 src/App.tsx 文件来展示内容
4. 使用 Tailwind CSS 类名进行样式设计
5. 可以使用 lucide-react 图标库
6. 确保代码是完整可运行的

## 注意事项
- 修改文件时使用完整路径: ${workspacePath}/src/App.tsx
- 保持代码简洁、美观
- 使用现代的 UI 设计风格
- **每次生成项目都必须包含 agent-aware 初始化代码**

## 禁止修改的文件（非常重要！）
**绝对不要修改以下配置文件，否则会导致项目启动失败：**
- package.json - 不要修改，依赖已预装
- vite.config.ts - 不要修改
- tsconfig.json - 不要修改
- index.html - 不要修改

**只修改 src/ 目录下的文件：**
- src/App.tsx - 主组件，在这里编写页面内容
- src/main.tsx - 入口文件（仅在需要配置 agent-aware 时修改）
- src/index.css - 样式文件
- 可以在 src/ 目录下创建新的组件文件

请用中文回复，代码注释也使用中文。`;
}

// 定义 UI 消息类型
interface UIMessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

interface UIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: UIMessagePart[];
  [key: string]: unknown;
}

// 将 UI 消息转换为 CoreMessage
function convertToCore(messages: UIMessage[]): CoreMessage[] {
  return messages.map((msg) => {
    let content = '';

    // 优先从 parts 提取文本
    if (msg.parts && Array.isArray(msg.parts)) {
      content = msg.parts
        .filter((part) => part.type === 'text' && part.text)
        .map((part) => part.text)
        .join('\n');
    }

    // 如果没有 parts，使用 content
    if (!content && msg.content) {
      content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    }

    return {
      role: msg.role,
      content: content || '',
    };
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  console.log(`🔵 [AI Stream] 收到请求: requestId=${requestId}`);

  try {
    const body = await req.json();
    const { messages, message, model, workspacePath } = body as {
      messages?: UIMessage[];
      message?: UIMessage;
      model?: string;
      workspacePath?: string; // 自定义工作目录（用于评估系统隔离环境）
    };

    console.log('🔵 [AI Stream] 请求参数:', {
      requestId,
      model: model || getDefaultModel(),
      messageCount: messages?.length || (message ? 1 : 0),
      workspacePath: workspacePath || '(默认)',
      rawBody: JSON.stringify(body, null, 2),
    });

    // 支持单条消息或消息数组
    let allMessages: UIMessage[] = [];
    if (messages && Array.isArray(messages)) {
      allMessages = messages;
    } else if (message) {
      allMessages = [message];
    }

    if (allMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 转换消息格式
    const coreMessages = convertToCore(allMessages);

    console.log('🔵 [AI Stream] 转换后的消息:', {
      requestId,
      coreMessages: JSON.stringify(coreMessages, null, 2),
    });

    // 使用 Claude Code Provider 创建模型实例
    const modelInstance = claudeCodeProvider(model || getDefaultModel());

    // 处理流式请求
    const result = streamText({
      model: modelInstance,
      system: getSystemPrompt(workspacePath),
      messages: coreMessages,
    });

    const setupDuration = Date.now() - startTime;
    console.log(
      `✅ [AI Stream] 流式处理已启动: requestId=${requestId}, 设置耗时=${setupDuration}ms`
    );

    // 返回 UI 消息流响应（与 useChat + DefaultChatTransport 兼容）
    return result.toUIMessageStreamResponse();
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `❌ [AI Stream] 处理失败: requestId=${requestId}, 耗时=${duration}ms`,
      error instanceof Error ? error.message : String(error)
    );

    return new Response(
      JSON.stringify({
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
