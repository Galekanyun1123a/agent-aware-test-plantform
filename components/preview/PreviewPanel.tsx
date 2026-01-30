'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ExternalLink,
  Globe,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface PreviewPanelProps {
  /** 预览地址 */
  previewUrl?: string;
  /** 默认预览地址 */
  defaultUrl?: string;
}

/**
 * 预览面板组件
 * 使用 iframe 展示实时预览
 */
export function PreviewPanel({
  previewUrl,
  defaultUrl = 'http://localhost:5173',
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentUrl, setCurrentUrl] = useState(previewUrl || defaultUrl);
  const [inputUrl, setInputUrl] = useState(previewUrl || defaultUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 刷新预览
  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = currentUrl;
    }
  }, [currentUrl]);

  // 导航到新地址
  const handleNavigate = useCallback(() => {
    if (inputUrl && inputUrl !== currentUrl) {
      setCurrentUrl(inputUrl);
      setIsLoading(true);
      setHasError(false);
    }
  }, [inputUrl, currentUrl]);

  // 在新标签页打开
  const handleOpenExternal = useCallback(() => {
    window.open(currentUrl, '_blank');
  }, [currentUrl]);

  // 切换全屏
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // iframe 加载完成
  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // iframe 加载错误
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  return (
    <div
      className={`flex flex-col h-full w-full ${
        isFullscreen ? 'fixed inset-0 z-50 bg-background' : 'relative'
      }`}
    >
      {/* 导航栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            title="刷新"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* URL 输入框 */}
        <div className="flex-1 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-muted/50 rounded-md px-3 py-1.5">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNavigate();
                }
              }}
              onBlur={handleNavigate}
              className="border-0 bg-transparent h-auto p-0 focus-visible:ring-0 text-sm"
              placeholder="输入预览地址..."
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenExternal}
            title="在新标签页打开"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 状态指示器 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              加载中
            </span>
          ) : hasError ? (
            <span className="text-destructive">连接失败</span>
          ) : (
            <span className="text-green-600">已连接</span>
          )}
        </div>
      </div>

      {/* 预览内容 */}
      <div className="flex-1 relative bg-white">
        {/* 加载状态覆盖层 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">正在加载预览...</p>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {hasError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-4 max-w-md px-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Globe className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="font-semibold">无法连接到预览服务</h3>
              <p className="text-sm text-muted-foreground">
                请确保开发服务器正在运行。您可以在工作目录中运行{' '}
                <code className="bg-muted px-1 rounded">npm run dev</code> 启动服务。
              </p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
            </div>
          </div>
        )}

        {/* iframe */}
        <iframe
          ref={iframeRef}
          src={currentUrl}
          className="w-full h-full border-0"
          onLoad={handleLoad}
          onError={handleError}
          title="预览"
        />
      </div>
    </div>
  );
}
