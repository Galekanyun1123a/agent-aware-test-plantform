'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Send, Square } from 'lucide-react';
import { useCallback, useRef, type KeyboardEvent, type FormEvent } from 'react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 输入框组件
 * 支持多行输入和快捷键提交
 */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading = false,
  placeholder = '输入您的需求...',
  disabled = false,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 提交（Shift+Enter 换行）
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && value.trim()) {
          const form = e.currentTarget.form;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    },
    [isLoading, value]
  );

  // 自动调整高度
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="relative flex items-end gap-2 bg-background border rounded-lg p-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'min-h-[44px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pr-12',
            'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent'
          )}
          rows={1}
        />
        <div className="absolute right-3 bottom-3">
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={onStop}
              className="h-8 w-8"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!value.trim() || disabled}
              className="h-8 w-8"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1 px-1">
        按 Enter 发送，Shift+Enter 换行
      </p>
    </form>
  );
}
