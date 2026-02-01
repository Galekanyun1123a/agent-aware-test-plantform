/**
 * 评估系统核心类型定义
 * 基于 Anthropic 文章的评估架构
 *
 * @see https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
 */

// ==================== 任务定义 ====================

/**
 * 评估任务定义
 */
export interface EvalTask {
  /** 任务唯一标识，格式：001-task-name */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述（会作为 System Prompt 的一部分） */
  description: string;
  /** 用户消息列表（支持多轮对话） */
  userMessages: string[];
  /** 评分器配置列表 */
  graders: GraderConfig[];
  /** 任务超时时间（毫秒），默认 300000 */
  timeout?: number;
  /** 初始化脚本（在任务开始前执行的 shell 脚本） */
  setupScript?: string;
  /** 任务分类 */
  category?: string;
}

// ==================== 评分器配置 ====================

/**
 * 评分器配置（联合类型）
 */
export type GraderConfig =
  | DependencyGraderConfig
  | ServerGraderConfig
  | DataCollectionGraderConfig
  | StorageGraderConfig
  | ContextGraderConfig
  | DetectionGraderConfig
  | ErrorHandleGraderConfig
  | CodeGraderConfig
  | LLMGraderConfig
  | RuntimeGraderConfig
  | BehaviorGraderConfig
  | AlertGraderConfig;

/**
 * 依赖检查评分器配置
 */
export interface DependencyGraderConfig {
  type: 'dependency';
  checks: {
    /** 要检查的包名 */
    packageName: string;
    /** 导入语句检查（正则表达式） */
    importCheck?: string;
    /** 初始化检查（正则表达式） */
    initCheck?: string;
    /** 检查的文件路径 */
    targetFile?: string;
  };
}

/**
 * 服务检查评分器配置
 */
export interface ServerGraderConfig {
  type: 'server';
  /** 检查的端口 */
  port: number;
  /** 检查的端点 */
  endpoint: string;
  /** 启动超时（毫秒） */
  timeout?: number;
  /** 期望的 HTTP 方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 服务器启动命令 */
  startCommand?: string;
}

/**
 * 数据收集评分器配置
 */
export interface DataCollectionGraderConfig {
  type: 'data-collection';
  /** 测试数据 */
  testData: object[];
  /** 期望的字段 */
  expectedFields: string[];
  /** 发送数据的端点 */
  endpoint: string;
  /** 端口 */
  port: number;
}

/**
 * 文件存储评分器配置
 */
export interface StorageGraderConfig {
  type: 'storage';
  /** 存储文件路径（相对于项目目录） */
  filePath: string;
  /** 最少记录数 */
  minRecords?: number;
  /** 期望的数据结构字段 */
  expectedFields?: string[];
}

/**
 * 上下文复用评分器配置
 */
export interface ContextGraderConfig {
  type: 'context';
  /** 期望答案（字符串或正则表达式） */
  expectedAnswer: string | RegExp;
  /** 检查的响应索引（多轮对话时使用） */
  responseIndex?: number;
}

/**
 * AI 检测能力评分器配置
 */
export interface DetectionGraderConfig {
  type: 'detection';
  /** 期望检测到的问题 */
  issues: string[];
  /** 检查修复后的文件路径 */
  fixedFilePath?: string;
}

/**
 * 错误处理评分器配置
 */
export interface ErrorHandleGraderConfig {
  type: 'error-handle';
  /** 错误测试用例 */
  errorCases: Array<{
    /** 用例名称 */
    name: string;
    /** 请求内容 */
    request: {
      body?: unknown;
      contentType?: string;
    };
    /** 期望的状态码 */
    expectStatus: number;
  }>;
  /** 端口 */
  port: number;
  /** 端点 */
  endpoint: string;
}

/**
 * 代码检查评分器配置
 */
export interface CodeGraderConfig {
  type: 'code';
  checks: {
    /** 是否检查依赖安装 */
    npmInstall?: boolean;
    /** 是否检查构建 */
    npmBuild?: boolean;
    /** 是否检查文件存在 */
    fileExists?: string[];
    /** 文件内容检查（正则表达式） */
    fileContains?: Array<{
      file: string;
      pattern: string;
    }>;
  };
}

/**
 * LLM 评分器配置
 */
export interface LLMGraderConfig {
  type: 'llm';
  /** Rubric 文件路径（相对于 evals/rubrics/） */
  rubric: string;
  /** 评估维度 */
  dimensions: string[];
  /** 通过阈值（0-1），默认 0.7 */
  threshold?: number;
}

/**
 * 运行时评分器配置（浏览器自动化测试）
 */
export interface RuntimeGraderConfig {
  type: 'runtime';
  /** 开发服务器端口 */
  port: number;
  /** 页面加载超时（毫秒） */
  timeout?: number;
  /** 期望页面包含的文本 */
  expectText?: string | string[];
  /** 期望页面包含的元素选择器 */
  expectSelector?: string | string[];
  /** 启动命令 */
  startCommand?: string;
  /** 用户行为模拟操作 */
  userActions?: Array<{
    type: 'click' | 'type' | 'wait' | 'scroll';
    selector?: string;
    value?: string;
    timeout?: number;
  }>;
  /** 是否等待 agent-aware 检测文件 */
  waitForAgentAware?: boolean;
}

/**
 * 用户行为检测评分器配置
 * 对应 getSystemPrompt 中描述的 BehaviorDetector
 */
export interface BehaviorGraderConfig {
  type: 'behavior';
  /** 检查配置 */
  checks: {
    /** 是否检查挫折检测 */
    frustration?: boolean;
    /** 是否检查愤怒点击检测 */
    rageClick?: boolean;
    /** 是否检查死点击检测 */
    deadClick?: boolean;
    /** 是否检查 AI 修复响应 */
    aiResponse?: boolean;
  };
  /** 预期严重程度 */
  expectedSeverity?: 'critical' | 'warning' | 'info';
  /** 行为文件路径 */
  behaviorFilePath?: string;
}

/**
 * 错误检测评分器配置
 * 对应 getSystemPrompt 中描述的 AlertDetector
 */
export interface AlertGraderConfig {
  type: 'alert';
  /** 检查配置 */
  checks: {
    /** 是否检查错误文件存在 */
    fileExists?: boolean;
    /** 期望的错误数量（最少） */
    minErrorCount?: number;
    /** 期望的错误类型 */
    errorTypes?: Array<'runtime' | 'promise' | 'console'>;
    /** 是否检查 AI 修复响应 */
    aiResponse?: boolean;
    /** 期望包含的错误消息关键词 */
    errorMessageContains?: string[];
  };
  /** 错误文件路径 */
  errorFilePath?: string;
}

// ==================== 评分结果 ====================

export interface GraderResult {
  /** 评分器类型 */
  type: string;
  /** 是否通过 */
  passed: boolean;
  /** 分数（0-1） */
  score: number;
  /** 详细信息 */
  details: Record<string, unknown>;
  /** 错误信息（如果失败） */
  error?: string;
}

// ==================== Transcript ====================

export type TranscriptEntryType =
  | 'user_message'
  | 'assistant_message'
  | 'tool_call'
  | 'tool_result'
  | 'step_start'
  | 'step_finish'
  | 'error'
  | 'grader_result';

export interface TranscriptEntry {
  /** 时间戳（毫秒，相对于开始时间） */
  timestamp: number;
  /** 条目类型 */
  type: TranscriptEntryType;
  /** 内容（根据类型不同结构不同） */
  content: unknown;
}

// ==================== Outcome ====================

export interface OutcomeState {
  /** 生成的文件列表 */
  files: string[];
  /** 服务器是否启动成功 */
  serverStarted: boolean;
  /** 数据收集是否成功 */
  dataCollected: boolean;
  /** 文件存储是否成功 */
  fileStored: boolean;
  /** 控制台错误列表 */
  consoleErrors: string[];
}

// ==================== Trial 结果 ====================

export interface TrialResult {
  /** 任务 ID */
  taskId: string;
  /** 试验索引（从 0 开始） */
  trialIndex: number;
  /** 是否通过（所有评分器都通过） */
  passed: boolean;
  /** 各评分器的分数 */
  scores: Record<string, number>;
  /** 各评分器的详细结果 */
  graderResults: GraderResult[];
  /** 完整 Transcript */
  transcript: TranscriptEntry[];
  /** 最终状态 */
  outcome: OutcomeState;
  /** 耗时（毫秒） */
  duration: number;
  /** 错误信息（如果失败） */
  error?: string;
}

// ==================== 评估结果 ====================

export interface EvalResult {
  /** 任务 ID */
  taskId: string;
  /** 是否通过 */
  passed: boolean;
  /** 试验结果 */
  trial: TrialResult;
  /** 耗时（毫秒） */
  duration: number;
}

export interface EvalReport {
  /** 报告生成时间 */
  timestamp: string;
  /** 使用的模型 */
  model: string;
  /** 进度信息 */
  progress: {
    completed: number;
    total: number;
    percentage: string;
  };
  /** 所有任务的评估结果 */
  results: EvalResult[];
  /** 总体统计 */
  summary: {
    totalTasks: number;
    passedTasks: number;
    passRate: string;
  };
}
