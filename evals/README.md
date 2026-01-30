# Agent-Aware 评估系统

基于 [Anthropic 官方文章](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) 的最佳实践设计的 Agent 代码生成能力评估系统。

## 核心概念

| 概念 | 定义 |
|------|------|
| **Task** | 单个评估任务，包含输入和成功标准 |
| **Grader** | 评分逻辑，评估 Agent 的某个方面 |
| **Transcript** | 完整的交互记录（所有消息、工具调用、推理过程） |
| **Outcome** | 环境的最终状态（文件系统、服务器状态等） |

## 快速开始

```bash
# 安装依赖
npm install

# 运行所有评估
npm run eval

# 运行特定任务
npm run eval:task 001

# 查看所有任务
npm run eval:list

# 查看所有分类
npm run eval:categories
```

## 目录结构

```
evals/
├── README.md                     # 本文档
├── config.ts                     # 评估配置
├── run.ts                        # 评估运行入口（CLI）
├── index.ts                      # 模块导出
│
├── harness/                      # 评估基础设施
│   ├── types.ts                  # 核心类型定义
│   ├── runner.ts                 # 评估运行器
│   ├── environment.ts            # 隔离环境管理
│   ├── transcript.ts             # Transcript 记录器
│   ├── reporter.ts               # 结果报告生成
│   └── progress.ts               # 进度显示
│
├── graders/                      # 评分器
│   ├── dependency-grader.ts      # 依赖安装检查
│   ├── server-grader.ts          # 服务器启动检查
│   ├── data-collection-grader.ts # 数据收集验证
│   ├── storage-grader.ts         # 文件存储检查
│   ├── context-grader.ts         # 上下文复用检查
│   ├── detection-grader.ts       # AI 检测能力评估
│   ├── error-handle-grader.ts    # 错误处理评估
│   ├── code-grader.ts            # 代码检查
│   ├── llm-grader.ts             # LLM 评分
│   └── shared/                   # 共享工具
│
├── tasks/                        # 任务定义
│   ├── index.ts                  # 任务注册表
│   ├── schema.ts                 # 任务 Schema
│   └── agent-aware/              # agent-aware 相关任务
│       ├── 001-integration.ts    # 基础集成
│       ├── 002-server-startup.ts # 服务启动
│       ├── 003-data-collection.ts # 数据收集
│       ├── 004-file-storage.ts   # 文件存储
│       ├── 005-context-reuse.ts  # 上下文复用
│       ├── 006-ai-detection.ts   # AI 检测
│       └── 007-error-handling.ts # 错误处理
│
├── rubrics/                      # LLM 评分标准
│   ├── agent-aware-integration.md
│   ├── data-handling.md
│   └── error-recovery.md
│
├── fixtures/                     # 测试固定数据
│   ├── mock-behaviors.json
│   ├── problematic-behaviors.json
│   └── error-requests.json
│
└── results/                      # 评估结果（.gitignore）
    └── .gitkeep
```

## 评估任务

### 001-integration: Agent-Aware 集成
- **难度**: 简单
- **评估**: @reskill/agent-aware 库的正确集成
- **评分器**: dependency, code, llm

### 002-server-startup: 行为服务器启动
- **难度**: 中等
- **评估**: 创建并启动 4100 端口服务器
- **评分器**: code, server

### 003-data-collection: 数据收集验证
- **难度**: 中等
- **评估**: 服务器正确解析行为数据
- **评分器**: server, data-collection

### 004-file-storage: 文件持久化存储
- **难度**: 中等
- **评估**: 将行为数据存储到文件
- **评分器**: server, storage, code

### 005-context-reuse: 跨对话上下文复用
- **难度**: 中等
- **评估**: 读取和分析存储的数据
- **评分器**: context, llm

### 006-ai-detection: AI 主动检测能力
- **难度**: 较难
- **评估**: 检测数据问题并修复
- **评分器**: detection, storage, llm

### 007-error-handling: 错误数据处理能力
- **难度**: 较难
- **评估**: 处理各种异常请求
- **评分器**: server, error-handle, code, llm

## 评分器

### Dependency Grader
检查依赖是否正确安装和初始化。

### Server Grader
检查服务器是否能正常启动和响应。

### Data Collection Grader
验证服务器能正确接收和解析数据。

### Storage Grader
验证数据是否正确存储到文件。

### Context Grader
验证 AI 能正确使用存储的数据。

### Detection Grader
验证 AI 能识别数据问题。

### Error Handle Grader
验证服务器的错误处理能力。

### Code Grader
检查代码文件和内容。

### LLM Grader
使用 LLM 进行代码质量评估。

## 设计原则

1. **评估产出，而非路径** - 不检查工具调用顺序，只验证最终结果
2. **优先确定性评分器** - 服务器启动、文件存在等客观指标
3. **任务无歧义** - 两个领域专家应对同一任务独立得出相同判断
4. **隔离环境** - 每次试验独立运行，避免状态污染
5. **读 Transcript** - 每个失败都需要人工检查完整的对话记录

## 命令行参数

```bash
# 运行特定任务
npm run eval -- --task 001
npm run eval -- -t 001

# 运行特定分类
npm run eval -- --category server
npm run eval -- -c integration

# 指定模型
npm run eval -- --model sonnet

# 指定超时
npm run eval -- --timeout 600000

# 详细日志
npm run eval -- --verbose
npm run eval -- -v

# 帮助信息
npm run eval -- --help
```

## 环境变量

```bash
EVAL_TASK_ID=001      # 等同于 --task
EVAL_CATEGORY=server  # 等同于 --category
EVAL_MODEL=sonnet     # 等同于 --model
EVAL_TIMEOUT=300000   # 等同于 --timeout
EVAL_VERBOSE=true     # 等同于 --verbose
```

## 添加新任务

1. 在 `tasks/agent-aware/` 目录创建新文件：

```typescript
// tasks/agent-aware/008-new-task.ts
import type { EvalTask } from '../../harness/types';

export const task: EvalTask = {
  id: '008-new-task',
  name: '新任务名称',
  description: '任务描述',
  category: 'integration',
  userMessages: [
    '用户消息内容',
  ],
  graders: [
    { type: 'code', checks: { fileExists: ['file.ts'] } },
    // 更多评分器...
  ],
  timeout: 180000,
  setupScript: '可选的初始化脚本',
};
```

2. 在 `tasks/index.ts` 中注册：

```typescript
import { task as task008 } from './agent-aware/008-new-task';

export const allTasks: EvalTask[] = [
  // ...
  task008,
];
```

## 注意事项

1. **隔离环境**: 每次试验在 `/tmp/agent-aware-eval-*` 临时目录运行
2. **真实模型调用**: 使用真实的 AI 模型时会产生 API 费用
3. **读 Transcript**: 评估失败时应检查 `results/transcripts/` 中的对话记录
