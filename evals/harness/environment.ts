/**
 * 评估环境管理
 * 为每次评估创建隔离的运行环境
 * 
 * 基于 getSystemPrompt 中定义的项目结构：
 * - Vite + React + TypeScript 项目
 * - 主要入口文件: src/App.tsx
 * - 样式文件: src/index.css (使用 Tailwind CSS v4)
 * - 集成 @reskill/agent-aware 用户行为追踪
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { EvalConfig } from '../config';

export interface IsolatedEnvironment {
  /** 项目目录路径 */
  projectDir: string;
  /** Agent-Aware 检测目录路径 */
  agentAwareDir: string;
  /** 清理函数 */
  cleanup: () => Promise<void>;
  /** 运行的服务器进程列表 */
  serverProcesses: ChildProcess[];
  /** 添加服务器进程 */
  addServerProcess: (proc: ChildProcess) => void;
}

/**
 * 项目模板类型
 * - vite-react: Vite + React + TypeScript（默认）
 * - simple-html: 简单 HTML 项目
 * - nextjs: Next.js 项目
 * - node-server: Node.js 服务器项目
 * - minimal: 最小模板（仅目录结构）
 * - custom: 复制 workspace 目录
 */
export type TemplateType = 'vite-react' | 'simple-html' | 'nextjs' | 'node-server' | 'minimal' | 'custom';

/**
 * 创建隔离的评估环境
 * @param taskId 任务 ID
 * @param config 评估配置
 * @param setupScript 初始化脚本（可选）
 * @param templateType 模板类型（默认 vite-react）
 */
export async function createIsolatedEnvironment(
  taskId: string,
  config: EvalConfig,
  setupScript?: string,
  templateType: TemplateType = 'vite-react'
): Promise<IsolatedEnvironment> {
  const timestamp = Date.now();
  const envDir = path.join(config.tempDirPrefix, `${taskId}-${timestamp}`);

  console.log(`📁 [Environment] 创建隔离环境: ${envDir} (模板: ${templateType})`);

  // 创建临时目录
  fs.mkdirSync(envDir, { recursive: true });

  // 根据模板类型初始化项目
  switch (templateType) {
    case 'vite-react':
      await initViteReactTemplate(envDir);
      break;
    case 'simple-html':
      initSimpleHtmlTemplate(envDir);
      break;
    case 'nextjs':
      await initNextJsTemplate(envDir);
      break;
    case 'node-server':
      await initNodeServerTemplate(envDir);
      break;
    case 'minimal':
      initMinimalTemplate(envDir);
      break;
    case 'custom':
    default:
      // custom: 复制 workspace 模板到临时目录
      const workspaceSource = path.join(process.cwd(), 'workspace');
      if (fs.existsSync(workspaceSource)) {
        copyDirSync(workspaceSource, envDir);
      } else {
        // 如果 workspace 不存在，使用最小模板
        initMinimalTemplate(envDir);
      }
      break;
  }

  // 创建 .agent-aware 检测目录
  const agentAwareDir = path.join(envDir, '.agent-aware');
  fs.mkdirSync(agentAwareDir, { recursive: true });

  // 执行初始化脚本
  if (setupScript) {
    try {
      console.log(`🔧 [Environment] 执行初始化脚本...`);
      execSync(setupScript, {
        cwd: envDir,
        stdio: 'pipe',
        timeout: 30000,
        shell: true,
      });
    } catch (error) {
      console.warn(`⚠️ [Environment] 初始化脚本执行失败: ${error}`);
    }
  }

  const serverProcesses: ChildProcess[] = [];

  return {
    projectDir: envDir,
    agentAwareDir,
    serverProcesses,
    addServerProcess: (proc: ChildProcess) => {
      serverProcesses.push(proc);
    },
    cleanup: async () => {
      console.log(`🧹 [Environment] 清理环境: ${envDir}`);

      // 终止所有服务器进程
      for (const proc of serverProcesses) {
        try {
          if (!proc.killed) {
            proc.kill('SIGTERM');
            // 等待进程退出
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (!proc.killed) {
              proc.kill('SIGKILL');
            }
          }
        } catch {
          // 忽略清理错误
        }
      }

      // 删除临时目录
      if (config.verbose !== true) {
        // 非详细模式下清理临时文件
        try {
          if (fs.existsSync(envDir)) {
            fs.rmSync(envDir, { recursive: true, force: true });
          }
        } catch (error) {
          console.warn(`⚠️ [Environment] 清理临时目录失败: ${error}`);
        }
      } else {
        console.log(`📁 [Environment] 详细模式，保留临时目录: ${envDir}`);
      }
    },
  };
}

/**
 * 初始化 Vite + React 模板
 * 对应 getSystemPrompt 中描述的项目结构
 */
async function initViteReactTemplate(envDir: string): Promise<void> {
  console.log(`📦 [Template] 初始化 Vite + React + TypeScript 模板...`);

  // 创建目录结构
  fs.mkdirSync(path.join(envDir, 'src'), { recursive: true });

  // package.json - 包含 @reskill/agent-aware 依赖
  const packageJson = {
    name: 'eval-workspace',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      dev: 'vite --host',
      build: 'tsc && vite build',
      preview: 'vite preview',
    },
    dependencies: {
      '@reskill/agent-aware': 'latest',
      'lucide-react': '^0.563.0',
      react: '^19.2.0',
      'react-dom': '^19.2.0',
    },
    devDependencies: {
      '@tailwindcss/vite': '^4.1.18',
      '@types/react': '^19.2.5',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^5.1.1',
      tailwindcss: '^4.1.18',
      typescript: '~5.9.3',
      vite: '^7.2.4',
    },
  };
  fs.writeFileSync(
    path.join(envDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // vite.config.ts
  const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
})
`;
  fs.writeFileSync(path.join(envDir, 'vite.config.ts'), viteConfig);

  // tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ['src'],
  };
  fs.writeFileSync(
    path.join(envDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(envDir, 'index.html'), indexHtml);

  // src/main.tsx - 包含 initAgentAware() 初始化
  const mainTsx = `import { StrictMode } from 'react'
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
`;
  fs.writeFileSync(path.join(envDir, 'src/main.tsx'), mainTsx);

  // src/index.css - Tailwind CSS v4 导入
  const indexCss = `@import "tailwindcss";

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html, body, #root {
  height: 100%;
  width: 100%;
}
`;
  fs.writeFileSync(path.join(envDir, 'src/index.css'), indexCss);

  // src/App.tsx - 默认应用
  const appTsx = `import { Rocket } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="text-center space-y-6 p-8">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800">
          欢迎使用 Claude Code Agent
        </h1>
        <p className="text-xl text-gray-600 max-w-md">
          请在对话中描述你想要的页面，AI 将为你生成代码
        </p>
      </div>
    </div>
  )
}

export default App
`;
  fs.writeFileSync(path.join(envDir, 'src/App.tsx'), appTsx);

  // src/vite-env.d.ts
  fs.writeFileSync(
    path.join(envDir, 'src/vite-env.d.ts'),
    '/// <reference types="vite/client" />\n'
  );

  // 安装依赖
  console.log(`📦 [Template] 安装依赖...`);
  try {
    execSync('pnpm install', {
      cwd: envDir,
      stdio: 'pipe',
      timeout: 120000,
      shell: true,
    });
    console.log(`✅ [Template] 依赖安装完成`);
  } catch (error) {
    console.warn(`⚠️ [Template] 依赖安装失败: ${error}`);
  }

  console.log(`✅ [Template] Vite + React 模板初始化完成`);
}

/**
 * 初始化简单 HTML 模板
 */
function initSimpleHtmlTemplate(envDir: string): void {
  console.log(`📦 [Template] 初始化简单 HTML 模板...`);

  // index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; min-height: 100vh; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>
`;
  fs.writeFileSync(path.join(envDir, 'index.html'), indexHtml);

  console.log(`✅ [Template] 简单 HTML 模板初始化完成`);
}

/**
 * 初始化 Next.js 模板
 */
async function initNextJsTemplate(envDir: string): Promise<void> {
  console.log(`📦 [Template] 初始化 Next.js 模板...`);

  // 创建目录结构
  fs.mkdirSync(path.join(envDir, 'app'), { recursive: true });

  // package.json
  const packageJson = {
    name: 'eval-nextjs-workspace',
    private: true,
    version: '0.0.0',
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      '@reskill/agent-aware': 'latest',
      next: '^14.0.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      typescript: '^5.0.0',
      tailwindcss: '^3.4.0',
      autoprefixer: '^10.4.0',
      postcss: '^8.4.0',
    },
  };
  fs.writeFileSync(
    path.join(envDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      forceConsistentCasingInFileNames: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  };
  fs.writeFileSync(
    path.join(envDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  // next.config.js
  const nextConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
`;
  fs.writeFileSync(path.join(envDir, 'next.config.js'), nextConfig);

  // app/layout.tsx
  const layoutTsx = `import type { Metadata } from 'next'
import { initAgentAware } from '@reskill/agent-aware'
import './globals.css'

// 初始化 Agent-Aware
if (typeof window !== 'undefined') {
  initAgentAware()
}

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Generated by AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
`;
  fs.writeFileSync(path.join(envDir, 'app/layout.tsx'), layoutTsx);

  // app/page.tsx
  const pageTsx = `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl font-bold">欢迎使用 Next.js</h1>
    </main>
  )
}
`;
  fs.writeFileSync(path.join(envDir, 'app/page.tsx'), pageTsx);

  // app/globals.css
  const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

* { margin: 0; padding: 0; box-sizing: border-box; }
`;
  fs.writeFileSync(path.join(envDir, 'app/globals.css'), globalsCss);

  // tailwind.config.js
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
`;
  fs.writeFileSync(path.join(envDir, 'tailwind.config.js'), tailwindConfig);

  // postcss.config.js
  const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
  fs.writeFileSync(path.join(envDir, 'postcss.config.js'), postcssConfig);

  // 安装依赖
  console.log(`📦 [Template] 安装依赖...`);
  try {
    execSync('pnpm install', {
      cwd: envDir,
      stdio: 'pipe',
      timeout: 120000,
      shell: true,
    });
    console.log(`✅ [Template] 依赖安装完成`);
  } catch (error) {
    console.warn(`⚠️ [Template] 依赖安装失败: ${error}`);
  }

  console.log(`✅ [Template] Next.js 模板初始化完成`);
}

/**
 * 初始化 Node.js 服务器模板
 */
async function initNodeServerTemplate(envDir: string): Promise<void> {
  console.log(`📦 [Template] 初始化 Node.js 服务器模板...`);

  // 创建目录结构
  fs.mkdirSync(path.join(envDir, 'src'), { recursive: true });

  // package.json - 预装 @reskill/agent-aware-server
  const packageJson = {
    name: 'eval-node-server',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
      start: 'node --experimental-specifier-resolution=node src/server.js',
      dev: 'node --watch src/server.js',
      'agent-server': 'agent-aware-server',
    },
    dependencies: {
      '@reskill/agent-aware-server': 'latest',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
    },
  };
  fs.writeFileSync(
    path.join(envDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // src/server.js - 包含基本的 /behaviors 端点框架
  const serverJs = `import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 4100;
const DATA_DIR = path.join(process.cwd(), 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // POST /behaviors - 接收用户行为数据
  if (req.url === '/behaviors' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        // TODO: 添加数据验证和存储逻辑
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '数据接收成功' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 健康检查
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;
  fs.writeFileSync(path.join(envDir, 'src/server.js'), serverJs);

  // 创建数据目录
  fs.mkdirSync(path.join(envDir, 'data'), { recursive: true });

  // 安装依赖
  console.log(`📦 [Template] 安装依赖...`);
  try {
    execSync('pnpm install', {
      cwd: envDir,
      stdio: 'pipe',
      timeout: 60000,
      shell: true,
    });
    console.log(`✅ [Template] 依赖安装完成`);
  } catch (error) {
    console.warn(`⚠️ [Template] 依赖安装失败: ${error}`);
  }

  console.log(`✅ [Template] Node.js 服务器模板初始化完成`);
}

/**
 * 初始化最小模板（仅目录结构）
 */
function initMinimalTemplate(envDir: string): void {
  fs.mkdirSync(path.join(envDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(envDir, 'data'), { recursive: true });
}

/**
 * 递归复制目录
 */
function copyDirSync(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // 跳过 node_modules、.git、dist
    if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 列出项目文件
 */
export async function listProjectFiles(projectDir: string): Promise<string[]> {
  const files: string[] = [];

  function walkDir(dir: string, prefix = ''): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      // 跳过 node_modules, .git, dist 等
      if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) {
        continue;
      }

      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walkDir(path.join(dir, entry.name), relativePath);
      } else {
        files.push(relativePath);
      }
    }
  }

  walkDir(projectDir);
  return files;
}

/**
 * 收集代码内容（用于 LLM 评分）
 * 支持优先级文件排序，与参考项目一致
 */
export async function collectCodeContent(projectDir: string): Promise<string> {
  const files = await listProjectFiles(projectDir);

  // 支持的文件扩展名
  const codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.vue',
    '.json', '.yaml', '.yml',
  ];

  // 排除的目录/文件
  const excludePatterns = ['dist/', 'build/', '.next/', 'node_modules/', 'dev-server.log'];

  // 优先文件（优先级最高）
  const priorityFiles = [
    'package.json',
    'vite.config.ts',
    'vite.config.js',
    'tsconfig.json',
    'index.html',
    'src/main.tsx',
    'src/App.tsx',
    'src/index.css',
  ];

  // 分类文件
  const priority: string[] = [];
  const regular: string[] = [];

  for (const file of files) {
    // 跳过排除的文件
    if (excludePatterns.some((p) => file.includes(p))) continue;
    // 检查是否是支持的扩展名
    if (!codeExtensions.some((ext) => file.endsWith(ext))) continue;

    // 分类
    const basename = path.basename(file);
    if (priorityFiles.includes(basename) || priorityFiles.includes(file)) {
      priority.push(file);
    } else {
      regular.push(file);
    }
  }

  // 合并：优先文件在前
  const sortedFiles = [...priority, ...regular];
  const contents: string[] = [];

  // 最多读取 30 个代码文件
  for (const file of sortedFiles.slice(0, 30)) {
    try {
      const filePath = path.join(projectDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // 限制每个文件最多 500 行
      const lines = content.split('\n').slice(0, 500);
      contents.push(`// ========== ${file} ==========\n${lines.join('\n')}`);
    } catch {
      // 忽略读取失败的文件
    }
  }

  return contents.join('\n\n');
}

/**
 * 读取 .agent-aware 检测文件
 */
export function readAgentAwareFile(
  projectDir: string,
  fileName: 'behavior.json' | 'error.json'
): unknown | null {
  const filePath = path.join(projectDir, '.agent-aware', fileName);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 写入 .agent-aware 检测文件（用于模拟检测结果）
 */
export function writeAgentAwareFile(
  projectDir: string,
  fileName: 'behavior.json' | 'error.json',
  data: unknown
): void {
  const agentAwareDir = path.join(projectDir, '.agent-aware');
  fs.mkdirSync(agentAwareDir, { recursive: true });

  const filePath = path.join(agentAwareDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * 启动服务器进程
 */
export async function startServerProcess(
  projectDir: string,
  command: string,
  port: number,
  timeout = 30000
): Promise<ChildProcess> {
  console.log(`🚀 [Server] 启动服务器: ${command} (端口: ${port})`);

  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const proc = spawn(cmd, args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: true,
      env: {
        ...process.env,
        PORT: String(port),
        VITE_PORT: String(port),
      },
    });

    let output = '';
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server startup timeout after ${timeout}ms\nOutput: ${output.slice(-500)}`));
      }
    }, timeout);

    proc.stdout?.on('data', (data) => {
      output += data.toString();
      // 检查服务器是否已启动
      if (
        output.includes(`${port}`) ||
        output.includes('listening') ||
        output.includes('ready') ||
        output.includes('Local:')
      ) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          console.log(`✅ [Server] 服务器启动成功 (端口: ${port})`);
          resolve(proc);
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(error);
      }
    });

    proc.on('exit', (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        clearTimeout(timeoutId);
        reject(new Error(`Server process exited with code ${code}: ${output.slice(-500)}`));
      }
    });

    // 定期检查端口
    const checkInterval = setInterval(async () => {
      if (!resolved) {
        try {
          const isReady = await checkPort(port);
          if (isReady) {
            resolved = true;
            clearTimeout(timeoutId);
            clearInterval(checkInterval);
            console.log(`✅ [Server] 服务器端口已可用 (${port})`);
            resolve(proc);
          }
        } catch {
          // 继续等待
        }
      } else {
        clearInterval(checkInterval);
      }
    }, 1000);
  });
}

/**
 * 检查端口是否可用
 */
async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const net = require('node:net');
    const client = new net.Socket();

    client.setTimeout(1000);

    client.on('connect', () => {
      client.destroy();
      resolve(true);
    });

    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });

    client.on('error', () => {
      client.destroy();
      resolve(false);
    });

    client.connect(port, '127.0.0.1');
  });
}

/**
 * 杀死占用端口的进程
 */
export async function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
        stdio: 'pipe',
      });
    } catch {
      // 忽略错误（可能没有进程占用）
    }
    // 等待进程完全退出
    setTimeout(resolve, 500);
  });
}

/**
 * 安装项目依赖
 */
export async function installDependencies(
  projectDir: string,
  timeout = 120000
): Promise<void> {
  console.log(`📦 [Install] 安装依赖: ${projectDir}`);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('依赖安装超时'));
    }, timeout);

    try {
      execSync('pnpm install', {
        cwd: projectDir,
        stdio: 'pipe',
        timeout,
      });
      clearTimeout(timeoutId);
      console.log(`✅ [Install] 依赖安装完成`);
      resolve();
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error(`依赖安装失败: ${error}`));
    }
  });
}
