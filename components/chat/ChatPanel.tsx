'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageList } from './MessageList';
import { PromptInput } from './PromptInput';
import { Bot } from 'lucide-react';
import { useState, useCallback, useMemo, type FormEvent } from 'react';

/**
 * 聊天面板组件
 * 整合消息列表和输入框，管理聊天状态
 */
export function ChatPanel() {
  const [input, setInput] = useState('');

  // 创建 transport 配置
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai-stream',
      }),
    []
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // 处理表单提交
  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      // 发送消息，使用正确的格式
      sendMessage({ text: input });
      setInput('');
    },
    [input, isLoading, sendMessage]
  );

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">Claude Code Agent</h2>
          <p className="text-xs text-muted-foreground">
            {isLoading ? '正在思考...' : '准备就绪'}
          </p>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-4 pb-2">
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
            发生错误: {error.message}
          </div>
        </div>
      )}

      {/* 输入框 */}
      <div className="px-4 pb-4">
        <PromptInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={stop}
          isLoading={isLoading}
          placeholder="描述您想要生成的功能..."
        />
      </div>
    </div>
  );
}
