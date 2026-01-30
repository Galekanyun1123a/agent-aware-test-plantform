# Agent-Aware Test

AI Agent 代码生成能力评估系统，基于 [Anthropic 官方文章](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) 的最佳实践设计。

## 技术栈

- **框架**: Next.js 16 + React 19
- **AI**: Vercel AI SDK + Claude Code Provider (AWS Bedrock)
- **UI**: Tailwind CSS 4 + Radix UI + shadcn/ui
- **测试**: Vitest
- **CI/CD**: GitHub Actions

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local` 配置 AWS Bedrock 凭证：

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-west-2
```

### 3. 初始化工作区

```bash
pnpm setup:workspace
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
agent-aware-test/
├── app/                          # Next.js App Router
│   ├── api/ai-stream/            # AI 流式 API
│   ├── layout.tsx
│   └── page.tsx
├── components/                   # React 组件
│   ├── chat/                     # 聊天相关组件
│   ├── preview/                  # 预览面板
│   └── ui/                       # UI 基础组件
├── lib/                          # 工具库
├── evals/                        # 评估系统
│   ├── harness/                  # 评估基础设施
│   ├── graders/                  # 评分器
│   ├── tasks/                    # 任务定义
│   ├── rubrics/                  # LLM 评分标准
│   └── results/                  # 评估结果
├── data/                         # 数据文件
├── scripts/                      # 脚本
├── workspace/                    # 测试工作区（Vite 项目）
└── .github/workflows/            # GitHub Actions CI/CD
```

## 评估系统

### 核心概念

| 概念 | 定义 |
|------|------|
| **Task** | 单个评估任务，包含输入和成功标准 |
| **Grader** | 评分逻辑，评估 Agent 的某个方面 |
| **Transcript** | 完整的交互记录 |
| **Outcome** | 环境的最终状态 |

### 评估任务

| ID | 名称 | 难度 | 分类 |
|----|------|------|------|
| 001 | Agent-Aware 集成 | 简单 | integration |
| 002 | 行为服务器启动 | 中等 | server |
| 003 | 数据收集验证 | 中等 | data |
| 004 | 文件持久化存储 | 中等 | storage |
| 005 | 跨对话上下文复用 | 中等 | context |
| 006 | AI 主动检测能力 | 较难 | ai-detection |
| 007 | 错误数据处理能力 | 较难 | error-handling |

### 运行评估

```bash
# 运行所有评估
pnpm eval

# 运行特定任务
pnpm eval --task 001

# 查看所有任务
pnpm eval:list

# 查看所有分类
pnpm eval:categories

# 运行特定分类
pnpm eval --category server
```

### 评估测试（Vitest）

```bash
# 运行评估系统测试
pnpm test:evals

# 监视模式
pnpm test:evals:watch
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器（Next.js + Vite 预览） |
| `pnpm dev:next` | 仅启动 Next.js |
| `pnpm dev:preview` | 仅启动 Vite 预览 |
| `pnpm build` | 构建生产版本 |
| `pnpm lint` | 代码检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 运行单元测试 |
| `pnpm test:evals` | 运行评估系统测试 |
| `pnpm test:coverage` | 生成测试覆盖率报告 |

## CI/CD

项目使用 GitHub Actions 进行持续集成：

### 主工作流 (ci.yml)

- **触发条件**: PR、推送到主分支
- **Jobs**: 安装依赖 → 类型检查 / Lint / 测试 → 构建

### 评估工作流 (evals.yml)

- **自动触发**: evals 文件变更、定时任务
- **手动触发**: 支持 4 种模式
  - `parallel`: 7 个任务并行
  - `serial`: 串行执行全部
  - `single`: 执行指定任务
  - `stability`: 稳定性测试

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `AWS_ACCESS_KEY_ID` | AWS 访问密钥 | 是 |
| `AWS_SECRET_ACCESS_KEY` | AWS 秘密密钥 | 是 |
| `AWS_REGION` | AWS 区域 | 是 |
| `WORKSPACE_PATH` | 工作区路径 | 否 |
| `EVAL_TASK_ID` | 评估任务 ID | 否 |
| `EVAL_CATEGORY` | 评估分类 | 否 |
| `EVAL_MODEL` | 评估模型 | 否 |
| `EVAL_VERBOSE` | 详细日志 | 否 |

## 添加新评估任务

1. 在 `evals/tasks/agent-aware/` 创建任务文件：

```typescript
// 008-new-task.ts
import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '008-new-task',
  name: '新任务名称',
  description: '任务描述',
  category: 'integration',
  userMessages: ['用户消息'],
  graders: [
    { type: 'code', checks: { fileExists: ['file.ts'] } },
  ],
};
```

2. 在 `evals/tasks/index.ts` 注册任务。

## 设计原则

1. **评估产出，而非路径** - 不检查工具调用顺序，只验证最终结果
2. **优先确定性评分器** - 服务器启动、文件存在等客观指标
3. **任务无歧义** - 领域专家应对同一任务独立得出相同判断
4. **隔离环境** - 每次试验独立运行，避免状态污染
5. **读 Transcript** - 失败时检查完整的对话记录

## License

MIT
