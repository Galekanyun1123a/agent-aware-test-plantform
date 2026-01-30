/**
 * Claude Code Provider 配置
 * 使用 ai-sdk-provider-claude-code 创建 Claude Code 实例
 */

import { createClaudeCode } from 'ai-sdk-provider-claude-code';

/**
 * 获取工作目录路径
 * 优先使用环境变量配置，否则使用默认路径
 */
function getWorkspacePath(): string {
  const workspacePath = process.env.WORKSPACE_PATH;
  if (workspacePath) {
    return workspacePath.endsWith('/') ? workspacePath : `${workspacePath}/`;
  }
  // 默认使用项目根目录下的 workspace 文件夹
  return process.cwd() + '/workspace/';
}

/**
 * 创建 Claude Code Provider 实例
 * 
 * 配置说明：
 * - permissionMode: 'acceptEdits' - 自动接受编辑操作
 * - additionalDirectories: 允许访问的目录列表
 * - streamingInput: 'always' - 始终使用流式输入
 * - allowedTools: 允许使用的工具列表
 */
export const claudeCodeProvider = createClaudeCode({
  defaultSettings: {
    permissionMode: 'acceptEdits',
    additionalDirectories: [getWorkspacePath()],
    streamingInput: 'always',
    allowedTools: [
      'Read',      // 读取文件
      'Write',     // 写入文件
      'Edit',      // 编辑文件
      'Bash',      // 执行 bash 命令
      'Grep',      // 搜索文件内容
      'LS',        // 列出目录
      'WebFetch',  // 获取网页内容
    ],
    verbose: process.env.NODE_ENV === 'development',
  },
});

/**
 * 获取默认模型名称
 */
export function getDefaultModel(): string {
  return process.env.ANTHROPIC_DEFAULT_MODEL || 'sonnet';
}
