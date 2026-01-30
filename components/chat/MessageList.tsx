'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

/**
 * 消息列表组件
 * 显示用户和 AI 的对话消息
 */
export function MessageList({ messages, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Bot className="w-12 h-12 mx-auto opacity-50" />
          <p className="text-lg">开始与 AI 对话</p>
          <p className="text-sm">输入您的需求，AI 将帮您生成代码</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4">
      <div className="space-y-4 pb-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}

/**
 * 单条消息组件
 */
function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex items-start gap-3',
        isUser && 'flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      <div
        className={cn(
          'flex-1 rounded-lg p-3 max-w-[80%]',
          isUser
            ? 'bg-primary text-primary-foreground ml-auto'
            : 'bg-muted/50'
        )}
      >
        <MessageContent message={message} />
      </div>
    </div>
  );
}

/**
 * 消息内容渲染
 * 支持文本和工具调用
 */
function MessageContent({ message }: { message: UIMessage }) {
  // AI SDK v6 使用 parts 数组
  if (!message.parts || message.parts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {message.parts.map((part, index) => {
        // 文本部分
        if (part.type === 'text') {
          return (
            <div key={index} className="whitespace-pre-wrap break-words">
              {part.text}
            </div>
          );
        }
        
        // 工具调用部分 - 检查类型是否以 'tool-' 开头
        if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
          const toolPart = part as { 
            type: string; 
            toolName?: string; 
            toolCallId?: string;
            state?: string;
          };
          const toolName = toolPart.toolName || part.type.replace('tool-', '');
          const state = toolPart.state;
          
          return (
            <div
              key={index}
              className="bg-background/50 rounded p-2 text-xs font-mono"
            >
              <div className="text-muted-foreground mb-1">
                🔧 {toolName}
              </div>
              {state === 'result' && (
                <div className="text-green-600 dark:text-green-400">
                  ✅ 完成
                </div>
              )}
              {state === 'error' && (
                <div className="text-red-600 dark:text-red-400">
                  ❌ 错误
                </div>
              )}
              {state && !['result', 'error'].includes(state) && (
                <div className="text-yellow-600 dark:text-yellow-400">
                  ⏳ 执行中...
                </div>
              )}
            </div>
          );
        }
        
        return null;
      })}
    </div>
  );
}
