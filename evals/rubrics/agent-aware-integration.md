# Agent-Aware 集成质量评分标准

## 评估目标

评估 AI Agent 在 Vite + React + TypeScript 项目中集成 @reskill/agent-aware 库的能力，包括：
- 依赖管理
- 初始化配置
- 代码质量
- 检测文件响应（.agent-aware/ 目录）

## 项目环境要求

基于 System Prompt 中定义的项目结构：
- Vite + React + TypeScript 项目
- 主要入口文件: src/App.tsx
- 样式文件: src/index.css (使用 Tailwind CSS v4)
- 预装依赖: @reskill/agent-aware, lucide-react

## 评估维度

### 依赖管理 (0-1)

评估依赖是否正确添加和安装。

- **1.0 分**: 正确在 package.json 中添加 @reskill/agent-aware 依赖，版本合理（latest 或具体版本号），依赖安装成功
- **0.7 分**: 依赖添加正确，但版本指定不够明确或使用了不推荐的版本格式
- **0.5 分**: 依赖添加在 devDependencies 而非 dependencies（对于运行时依赖不推荐）
- **0.3 分**: 依赖添加但安装失败或版本不兼容
- **0.0 分**: 依赖未添加或包名错误

### 初始化配置 (0-1)

评估 initAgentAware() 的调用是否正确。

- **1.0 分**: 
  - 在 src/main.tsx 中调用
  - 在 React 渲染之前调用（在 createRoot 之前）
  - 正确导入 initAgentAware 函数
  - 有适当的注释说明

- **0.7 分**: 调用位置正确，但配置参数不完整或注释不足

- **0.5 分**: 调用存在但位置不当（如在组件内部调用或在 createRoot 之后）

- **0.3 分**: 导入了库但未正确调用初始化函数

- **0.0 分**: 未初始化或初始化代码错误

### 初始化顺序 (0-1)

评估初始化顺序是否正确（新增维度）。

- **1.0 分**: initAgentAware() 在 createRoot() 之前调用，确保能捕获所有用户行为
- **0.5 分**: initAgentAware() 调用位置不明确，可能在渲染后执行
- **0.0 分**: initAgentAware() 在组件内部或渲染后调用

### 代码质量 (0-1)

评估集成代码的整体质量。

- **1.0 分**:
  - 代码结构清晰
  - 有适当的中文注释说明
  - 符合 TypeScript 最佳实践
  - 导入语句组织合理
  - 使用 Tailwind CSS 样式

- **0.7 分**: 代码可用，缺少部分注释

- **0.5 分**: 代码可用但不够清晰，缺少类型定义

- **0.3 分**: 代码存在明显的代码风格问题

- **0.0 分**: 代码混乱或存在语法错误

### UI 实现 (0-1)（可选）

评估页面 UI 实现质量（用于完整集成任务）。

- **1.0 分**:
  - 使用 Tailwind CSS 进行样式设计
  - 使用 lucide-react 图标
  - 页面布局合理、美观
  - 响应式设计

- **0.7 分**: 样式基本正确但设计不够精美

- **0.5 分**: 功能可用但样式简陋

- **0.0 分**: 无样式或样式错误

### Agent-Aware 检测响应 (0-1)（可选）

评估 AI 对 .agent-aware/ 目录检测文件的响应能力。

- **1.0 分**:
  - 正确读取 .agent-aware/behavior.json 或 error.json
  - 准确识别问题类型（挫折、愤怒点击、死点击、运行时错误）
  - 提供合理的修复方案

- **0.7 分**: 识别问题但修复方案不完整

- **0.5 分**: 读取了文件但未能正确分析问题

- **0.0 分**: 未能响应检测文件

## 示例代码（满分参考）

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAgentAware } from '@reskill/agent-aware'
import './index.css'
import App from './App'

// 初始化 Agent-Aware 用户行为追踪
// 必须在 React 渲染之前调用，确保能捕获所有用户行为
initAgentAware()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

## .agent-aware/ 检测文件格式

### behavior.json（行为检测）
```json
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
```

### error.json（错误检测）
```json
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
```

## 评分注意事项

1. **评估产出而非过程**：不关心 AI 使用了什么工具或命令，只关心最终结果
2. **允许合理的变体**：如使用 pnpm/yarn 替代 npm，或略有不同的配置格式
3. **关注核心功能**：确保 agent-aware 能正常工作是最重要的
4. **遵守文件修改规范**：不应修改 package.json、vite.config.ts、tsconfig.json、index.html 等配置文件
5. **中文输出**：代码注释应使用中文
