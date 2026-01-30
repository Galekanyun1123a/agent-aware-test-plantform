/**
 * 初始化 workspace 目录
 * 创建一个 Vite + React + TypeScript 项目
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workspacePath = path.join(process.cwd(), 'workspace');

// 检查 workspace 是否已存在
if (fs.existsSync(path.join(workspacePath, 'package.json'))) {
  console.log('✅ workspace 目录已存在，跳过初始化');
  process.exit(0);
}

console.log('🚀 正在初始化 workspace 目录...');

// 创建目录
fs.mkdirSync(workspacePath, { recursive: true });
fs.mkdirSync(path.join(workspacePath, 'src'), { recursive: true });

// package.json
const packageJson = {
  name: 'preview-workspace',
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
  path.join(workspacePath, 'package.json'),
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
fs.writeFileSync(path.join(workspacePath, 'vite.config.ts'), viteConfig);

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
  path.join(workspacePath, 'tsconfig.json'),
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
fs.writeFileSync(path.join(workspacePath, 'index.html'), indexHtml);

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
fs.writeFileSync(path.join(workspacePath, 'src/main.tsx'), mainTsx);

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
fs.writeFileSync(path.join(workspacePath, 'src/index.css'), indexCss);

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
          在左侧对话框中描述你想要的页面，AI 将为你生成代码并实时预览
        </p>
        <div className="flex gap-4 justify-center">
          <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm">
            React + TypeScript
          </div>
          <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm">
            Tailwind CSS
          </div>
          <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm">
            Vite HMR
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
`;
fs.writeFileSync(path.join(workspacePath, 'src/App.tsx'), appTsx);

// src/vite-env.d.ts
const viteEnvDts = `/// <reference types="vite/client" />
`;
fs.writeFileSync(path.join(workspacePath, 'src/vite-env.d.ts'), viteEnvDts);

console.log('✅ workspace 目录创建完成');
console.log('📦 正在安装依赖...');

// 安装依赖
try {
  execSync('pnpm install', { cwd: workspacePath, stdio: 'inherit' });
  console.log('✅ 依赖安装完成');
  console.log('\n🎉 初始化完成！运行 npm run dev 启动服务');
} catch (error) {
  console.error('❌ 依赖安装失败，请手动运行: cd workspace && pnpm install');
}
