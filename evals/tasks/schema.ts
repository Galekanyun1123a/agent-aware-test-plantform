/**
 * 任务 Schema 定义
 */

import { z } from 'zod';

/**
 * 依赖检查评分器配置 Schema
 */
export const dependencyGraderConfigSchema = z.object({
  type: z.literal('dependency'),
  checks: z.object({
    packageName: z.string(),
    importCheck: z.string().optional(),
    initCheck: z.string().optional(),
    targetFile: z.string().optional(),
  }),
});

/**
 * 服务检查评分器配置 Schema
 */
export const serverGraderConfigSchema = z.object({
  type: z.literal('server'),
  port: z.number(),
  endpoint: z.string(),
  timeout: z.number().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
  startCommand: z.string().optional(),
});

/**
 * 数据收集评分器配置 Schema
 */
export const dataCollectionGraderConfigSchema = z.object({
  type: z.literal('data-collection'),
  testData: z.array(z.object({}).passthrough()),
  expectedFields: z.array(z.string()),
  endpoint: z.string(),
  port: z.number(),
});

/**
 * 文件存储评分器配置 Schema
 */
export const storageGraderConfigSchema = z.object({
  type: z.literal('storage'),
  filePath: z.string(),
  minRecords: z.number().optional(),
  expectedFields: z.array(z.string()).optional(),
});

/**
 * 上下文复用评分器配置 Schema
 */
export const contextGraderConfigSchema = z.object({
  type: z.literal('context'),
  expectedAnswer: z.union([z.string(), z.instanceof(RegExp)]),
  responseIndex: z.number().optional(),
});

/**
 * AI 检测评分器配置 Schema
 */
export const detectionGraderConfigSchema = z.object({
  type: z.literal('detection'),
  issues: z.array(z.string()),
  fixedFilePath: z.string().optional(),
});

/**
 * 错误处理评分器配置 Schema
 */
export const errorHandleGraderConfigSchema = z.object({
  type: z.literal('error-handle'),
  errorCases: z.array(
    z.object({
      name: z.string(),
      request: z.object({
        body: z.unknown().optional(),
        contentType: z.string().optional(),
      }),
      expectStatus: z.number(),
    })
  ),
  port: z.number(),
  endpoint: z.string(),
});

/**
 * 代码检查评分器配置 Schema
 */
export const codeGraderConfigSchema = z.object({
  type: z.literal('code'),
  checks: z.object({
    npmInstall: z.boolean().optional(),
    npmBuild: z.boolean().optional(),
    fileExists: z.array(z.string()).optional(),
    fileContains: z
      .array(
        z.object({
          file: z.string(),
          pattern: z.string(),
        })
      )
      .optional(),
  }),
});

/**
 * LLM 评分器配置 Schema
 */
export const llmGraderConfigSchema = z.object({
  type: z.literal('llm'),
  rubric: z.string(),
  dimensions: z.array(z.string()),
  threshold: z.number().min(0).max(1).optional(),
});

/**
 * Runtime 评分器配置 Schema
 */
export const runtimeGraderConfigSchema = z.object({
  type: z.literal('runtime'),
  port: z.number(),
  timeout: z.number().optional(),
  expectText: z.union([z.string(), z.array(z.string())]).optional(),
  expectSelector: z.union([z.string(), z.array(z.string())]).optional(),
  startCommand: z.string().optional(),
  userActions: z.array(z.object({
    type: z.enum(['click', 'type', 'wait', 'scroll']),
    selector: z.string().optional(),
    value: z.string().optional(),
    timeout: z.number().optional(),
  })).optional(),
  waitForAgentAware: z.boolean().optional(),
});

/**
 * Behavior 评分器配置 Schema
 * 对应 getSystemPrompt 中描述的 BehaviorDetector
 */
export const behaviorGraderConfigSchema = z.object({
  type: z.literal('behavior'),
  checks: z.object({
    frustration: z.boolean().optional(),
    rageClick: z.boolean().optional(),
    deadClick: z.boolean().optional(),
    aiResponse: z.boolean().optional(),
  }),
  expectedSeverity: z.enum(['critical', 'warning', 'info']).optional(),
  behaviorFilePath: z.string().optional(),
});

/**
 * Alert 评分器配置 Schema
 * 对应 getSystemPrompt 中描述的 AlertDetector
 */
export const alertGraderConfigSchema = z.object({
  type: z.literal('alert'),
  checks: z.object({
    fileExists: z.boolean().optional(),
    minErrorCount: z.number().optional(),
    errorTypes: z.array(z.enum(['runtime', 'promise', 'console'])).optional(),
    aiResponse: z.boolean().optional(),
    errorMessageContains: z.array(z.string()).optional(),
  }),
  errorFilePath: z.string().optional(),
});

/**
 * 评分器配置 Schema（联合类型）
 */
export const graderConfigSchema = z.union([
  dependencyGraderConfigSchema,
  serverGraderConfigSchema,
  dataCollectionGraderConfigSchema,
  storageGraderConfigSchema,
  contextGraderConfigSchema,
  detectionGraderConfigSchema,
  errorHandleGraderConfigSchema,
  codeGraderConfigSchema,
  llmGraderConfigSchema,
  runtimeGraderConfigSchema,
  behaviorGraderConfigSchema,
  alertGraderConfigSchema,
]);

/**
 * 项目模板类型 Schema
 */
export const templateTypeSchema = z.enum([
  'vite-react',
  'simple-html',
  'nextjs',
  'node-server',
  'minimal',
  'custom',
]);

/**
 * 评估任务 Schema
 */
export const evalTaskSchema = z.object({
  /** 任务唯一标识，格式：001-task-name */
  id: z.string().regex(/^\d{3}-[a-z0-9-]+$/, {
    message: '任务 ID 格式应为: 001-task-name',
  }),
  /** 任务名称 */
  name: z.string().min(1, { message: '任务名称不能为空' }),
  /** 任务描述 */
  description: z.string().min(1, { message: '任务描述不能为空' }),
  /** 项目模板 ID（默认 vite-react） */
  templateId: templateTypeSchema.optional().default('vite-react'),
  /** 用户消息列表 */
  userMessages: z.array(z.string()).min(1, { message: '至少需要一条用户消息' }),
  /** 评分器配置列表 */
  graders: z.array(graderConfigSchema).min(1, { message: '至少需要一个评分器' }),
  /** 任务超时时间（毫秒） */
  timeout: z.number().positive().optional(),
  /** 初始化脚本 */
  setupScript: z.string().optional(),
  /** 任务分类 */
  category: z.string().optional(),
});

export type EvalTaskInput = z.infer<typeof evalTaskSchema>;

/**
 * 验证任务配置
 */
export function validateTask(task: unknown): EvalTaskInput {
  return evalTaskSchema.parse(task);
}
