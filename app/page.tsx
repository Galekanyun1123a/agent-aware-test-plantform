'use client';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { PreviewPanel } from '@/components/preview/PreviewPanel';

/**
 * 主页
 * 左侧聊天面板 + 右侧预览面板
 */
export default function Home() {
  // 预览地址，可从环境变量配置
  const previewUrl = process.env.NEXT_PUBLIC_PREVIEW_URL || 'http://localhost:5173';

  return (
    <main className="h-screen w-screen overflow-hidden bg-background flex">
      {/* 左侧聊天面板 - 固定 40% 宽度 */}
      <div className="w-[40%] h-full border-r bg-background overflow-hidden flex-shrink-0">
        <ChatPanel />
      </div>

      {/* 右侧预览面板 - 占据剩余空间 */}
      <div className="flex-1 h-full bg-muted/30 overflow-hidden">
        <PreviewPanel defaultUrl={previewUrl} />
      </div>
    </main>
  );
}
