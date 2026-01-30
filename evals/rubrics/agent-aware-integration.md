# Agent-Aware 集成质量评分标准

## 评估目标

评估 AI Agent 在项目中集成 @reskill/agent-aware 库的能力，包括依赖管理、初始化配置和代码质量。

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
  - 在正确的文件（main.tsx/index.tsx）中调用
  - 在 React 渲染之前调用
  - 配置了 endpoint 参数（http://localhost:4100/behaviors）
  - 可选：配置了 debug 模式

- **0.7 分**: 调用位置正确，但配置参数不完整

- **0.5 分**: 调用存在但位置不当（如在组件内部调用）

- **0.3 分**: 导入了库但未正确调用初始化函数

- **0.0 分**: 未初始化或初始化代码错误

### 代码质量 (0-1)

评估集成代码的整体质量。

- **1.0 分**:
  - 代码结构清晰
  - 有适当的注释说明
  - 符合 TypeScript 最佳实践
  - 导入语句组织合理

- **0.7 分**: 代码可用，缺少部分注释

- **0.5 分**: 代码可用但不够清晰，缺少类型定义

- **0.3 分**: 代码存在明显的代码风格问题

- **0.0 分**: 代码混乱或存在语法错误

## 示例代码（满分参考）

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAgentAware } from '@reskill/agent-aware'
import './index.css'
import App from './App'

// 初始化 Agent-Aware 用户行为追踪
// 在 React 渲染之前调用，确保能捕获所有用户行为
initAgentAware()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

## 评分注意事项

1. 评估产出而非过程：不关心 AI 使用了什么工具或命令，只关心最终结果
2. 允许合理的变体：如使用 pnpm/yarn 替代 npm，或略有不同的配置格式
3. 关注核心功能：确保 agent-aware 能正常工作是最重要的
