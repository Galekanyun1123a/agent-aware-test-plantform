/**
 * Workspace 管理器
 * 
 * 为并行评估任务提供完全隔离的工作空间：
 * - 每个任务有独立的项目目录
 * - 独立的端口配置
 * - 独立的 .agent-aware 检测目录
 * - 自动清理机制
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { EvalConfig } from '../config';

/**
 * 隔离的 Workspace 实例
 */
export interface IsolatedWorkspace {
  /** 唯一标识 */
  id: string;
  /** 任务 ID */
  taskId: string;
  /** 项目根目录 */
  projectDir: string;
  /** Agent-Aware 检测目录 */
  agentAwareDir: string;
  /** 开发服务器端口 */
  devPort: number;
  /** Agent-Aware 服务器端口 */
  serverPort: number;
  /** 是否已清理 */
  cleaned: boolean;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Workspace 管理器
 * 统一管理所有评估任务的隔离环境
 */
export class WorkspaceManager {
  private workspaces: Map<string, IsolatedWorkspace> = new Map();
  private baseDir: string;
  private basePort: number;
  private allocatedPorts: Set<number> = new Set();

  constructor(config: EvalConfig) {
    this.baseDir = config.tempDirPrefix;
    this.basePort = config.parallel?.basePort || 5200;
    
    // 确保基础目录存在
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * 创建隔离的 Workspace
   */
  async create(taskId: string, options: {
    setupScript?: string;
    copyTemplate?: boolean;
    installDeps?: boolean;
    templateId?: 'vite-react' | 'node-server';
  } = {}): Promise<IsolatedWorkspace> {
    const { setupScript, copyTemplate = true, installDeps = true, templateId = 'vite-react' } = options;
    
    // 生成唯一 ID
    const id = `${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const projectDir = path.join(this.baseDir, id);

    console.log(`📁 [Workspace] 创建隔离环境: ${id}`);

    // 分配端口
    const ports = this.allocatePorts();

    // 创建目录结构
    fs.mkdirSync(projectDir, { recursive: true });
    const agentAwareDir = path.join(projectDir, '.agent-aware');
    fs.mkdirSync(agentAwareDir, { recursive: true });

    // 复制模板（如果需要）
    if (copyTemplate) {
      if (templateId === 'node-server') {
        await this.initializeNodeServerTemplate(projectDir);
      } else {
        await this.initializeTemplate(projectDir, ports.devPort);
      }
    }

    // 安装依赖
    if (installDeps) {
      try {
        console.log(`📦 [Workspace] 安装依赖...`);
        execSync('pnpm install', {
          cwd: projectDir,
          stdio: 'pipe',
          timeout: 120000,
          shell: true,
        });
        console.log(`✅ [Workspace] 依赖安装完成`);
      } catch (error) {
        console.warn(`⚠️ [Workspace] 依赖安装失败: ${error}`);
      }
    }

    // 执行初始化脚本
    if (setupScript) {
      try {
        console.log(`🔧 [Workspace] 执行初始化脚本...`);
        execSync(setupScript, {
          cwd: projectDir,
          stdio: 'pipe',
          timeout: 30000,
          shell: true,
        });
      } catch (error) {
        console.warn(`⚠️ [Workspace] 初始化脚本执行失败: ${error}`);
      }
    }

    const workspace: IsolatedWorkspace = {
      id,
      taskId,
      projectDir,
      agentAwareDir,
      devPort: ports.devPort,
      serverPort: ports.serverPort,
      cleaned: false,
      createdAt: Date.now(),
    };

    this.workspaces.set(id, workspace);

    console.log(`✅ [Workspace] 创建成功:`);
    console.log(`   目录: ${projectDir}`);
    console.log(`   Dev 端口: ${ports.devPort}`);
    console.log(`   Server 端口: ${ports.serverPort}`);

    return workspace;
  }

  /**
   * 初始化 Vite + React + TypeScript 模板
   * @param projectDir 项目目录
   * @param devPort 开发服务器端口
   */
  private async initializeTemplate(projectDir: string, devPort: number): Promise<void> {
    // 创建目录结构
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

    // package.json - 使用动态端口
    const packageJson = {
      name: 'eval-workspace',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: `vite --host --port ${devPort} --strictPort`,
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
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // vite.config.ts - 使用动态端口和 strictPort 防止自动切换
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: ${devPort},
    strictPort: true, // 端口被占用时报错而不是自动切换
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
})
`;
    fs.writeFileSync(path.join(projectDir, 'vite.config.ts'), viteConfig);

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
      path.join(projectDir, 'tsconfig.json'),
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
    fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml);

    // src/main.tsx
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
    fs.writeFileSync(path.join(projectDir, 'src/main.tsx'), mainTsx);

    // src/index.css
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
    fs.writeFileSync(path.join(projectDir, 'src/index.css'), indexCss);

    // src/App.tsx
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
    fs.writeFileSync(path.join(projectDir, 'src/App.tsx'), appTsx);

    // src/vite-env.d.ts
    fs.writeFileSync(
      path.join(projectDir, 'src/vite-env.d.ts'),
      '/// <reference types="vite/client" />\n'
    );
  }

  /**
   * 初始化 Node.js 服务器模板
   * @param projectDir 项目目录
   */
  private async initializeNodeServerTemplate(projectDir: string): Promise<void> {
    console.log(`📦 [Workspace] 初始化 Node.js 服务器模板...`);

    // 创建目录结构
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'data'), { recursive: true });

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
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // src/server.js - 基础服务器（包含 /behaviors 端点）
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
    fs.writeFileSync(path.join(projectDir, 'src/server.js'), serverJs);
  }

  /**
   * 分配独立端口
   */
  private allocatePorts(): { devPort: number; serverPort: number } {
    let port = this.basePort;
    
    // 找到未被占用的端口对
    while (
      this.allocatedPorts.has(port) ||
      this.allocatedPorts.has(port + 1)
    ) {
      port += 2;
    }

    this.allocatedPorts.add(port);
    this.allocatedPorts.add(port + 1);

    return {
      devPort: port,
      serverPort: port + 1,
    };
  }

  /**
   * 释放端口
   */
  private releasePorts(devPort: number, serverPort: number): void {
    this.allocatedPorts.delete(devPort);
    this.allocatedPorts.delete(serverPort);
  }

  /**
   * 获取 Workspace
   */
  get(id: string): IsolatedWorkspace | undefined {
    return this.workspaces.get(id);
  }

  /**
   * 根据任务 ID 获取 Workspace
   */
  getByTaskId(taskId: string): IsolatedWorkspace | undefined {
    for (const workspace of this.workspaces.values()) {
      if (workspace.taskId === taskId && !workspace.cleaned) {
        return workspace;
      }
    }
    return undefined;
  }

  /**
   * 清理单个 Workspace
   */
  async cleanup(id: string, keepFiles = false): Promise<void> {
    const workspace = this.workspaces.get(id);
    if (!workspace || workspace.cleaned) return;

    console.log(`🧹 [Workspace] 清理: ${id}`);

    // 释放端口
    this.releasePorts(workspace.devPort, workspace.serverPort);

    // 删除文件（除非要保留）
    if (!keepFiles) {
      try {
        fs.rmSync(workspace.projectDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`⚠️ [Workspace] 清理文件失败: ${error}`);
      }
    }

    workspace.cleaned = true;
  }

  /**
   * 清理所有 Workspace
   */
  async cleanupAll(keepFiles = false): Promise<void> {
    console.log(`🧹 [Workspace] 清理所有 Workspace (共 ${this.workspaces.size} 个)`);
    
    for (const id of this.workspaces.keys()) {
      await this.cleanup(id, keepFiles);
    }
  }

  /**
   * 获取活动的 Workspace 数量
   */
  getActiveCount(): number {
    let count = 0;
    for (const workspace of this.workspaces.values()) {
      if (!workspace.cleaned) count++;
    }
    return count;
  }

  /**
   * 获取所有 Workspace
   */
  getAll(): IsolatedWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * 写入 Agent-Aware 检测文件
   */
  writeAgentAwareFile(
    workspace: IsolatedWorkspace,
    fileName: 'behavior.json' | 'error.json',
    data: unknown
  ): void {
    const filePath = path.join(workspace.agentAwareDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * 读取 Agent-Aware 检测文件
   */
  readAgentAwareFile(
    workspace: IsolatedWorkspace,
    fileName: 'behavior.json' | 'error.json'
  ): unknown | null {
    const filePath = path.join(workspace.agentAwareDir, fileName);
    
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
}

/**
 * 创建全局 Workspace 管理器实例
 */
let globalWorkspaceManager: WorkspaceManager | null = null;

export function getWorkspaceManager(config: EvalConfig): WorkspaceManager {
  if (!globalWorkspaceManager) {
    globalWorkspaceManager = new WorkspaceManager(config);
  }
  return globalWorkspaceManager;
}

export function resetWorkspaceManager(): void {
  globalWorkspaceManager = null;
}
