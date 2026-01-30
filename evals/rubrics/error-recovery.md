# 错误处理与恢复能力评分标准

## 评估目标

评估 AI Agent 识别、处理和恢复数据/系统错误的能力。

## 评估维度

### 问题识别 (0-1)

评估 AI 识别数据或系统问题的能力。

- **1.0 分**:
  - 识别出所有主要问题
  - 准确描述问题位置和原因
  - 区分不同类型的问题（格式、类型、缺失等）
  - 对问题进行了优先级排序

- **0.7 分**: 识别出大部分问题，描述基本准确

- **0.5 分**: 识别出一半以上的问题

- **0.3 分**: 只识别出少量明显问题

- **0.0 分**: 未能识别问题或误判正常数据为错误

### 修复方案 (0-1)

评估 AI 提出的修复方案的质量。

- **1.0 分**:
  - 方案可行且完整
  - 对每个问题都有对应的修复策略
  - 保留了有效数据
  - 修复后数据格式正确
  - 考虑了边界情况

- **0.7 分**: 方案基本可行，但有小疏漏

- **0.5 分**: 方案能解决主要问题，但不够完整

- **0.3 分**: 方案有明显缺陷或会引入新问题

- **0.0 分**: 方案不可行或会破坏更多数据

### 数据完整性 (0-1)

评估修复后数据的完整性。

- **1.0 分**:
  - 所有有效记录都被保留
  - 无效记录被正确处理（修复或删除）
  - 数据格式统一规范
  - 没有引入新的数据问题

- **0.7 分**: 保留了大部分有效数据，格式基本规范

- **0.5 分**: 部分有效数据丢失或格式不一致

- **0.3 分**: 数据完整性有明显损失

- **0.0 分**: 数据严重损坏或全部丢失

### 错误处理覆盖度 (0-1)

评估服务器错误处理的覆盖程度。

- **1.0 分**:
  - 处理 JSON 解析错误
  - 处理必填字段缺失
  - 处理数据类型错误
  - 处理请求体大小限制
  - 返回清晰的错误信息
  - 不会因错误导致崩溃

- **0.7 分**: 覆盖了主要错误类型

- **0.5 分**: 覆盖了一半以上的错误类型

- **0.3 分**: 只有基本的 try-catch

- **0.0 分**: 没有错误处理或处理不当

### 错误信息质量 (0-1)

评估错误响应的质量。

- **1.0 分**:
  - 使用正确的 HTTP 状态码
  - 错误信息描述具体问题
  - 包含修复建议
  - JSON 格式规范

- **0.7 分**: 状态码正确，信息较清晰

- **0.5 分**: 状态码基本正确，信息模糊

- **0.3 分**: 有错误响应但不够规范

- **0.0 分**: 没有错误响应或响应错误

### 代码健壮性 (0-1)

评估错误处理代码的健壮性。

- **1.0 分**:
  - 异常不会导致服务崩溃
  - 错误处理代码结构清晰
  - 有适当的日志记录
  - 考虑了并发请求

- **0.7 分**: 基本健壮，小问题不影响运行

- **0.5 分**: 存在可能导致问题的代码

- **0.3 分**: 部分场景可能崩溃

- **0.0 分**: 代码脆弱，容易崩溃

## 示例（满分参考）

### 问题识别示例

对于以下问题数据：
```json
[
  {"event_type": "click"},
  {"timestamp": "not-a-number"},
  {"event_type": null, "timestamp": 123}
]
```

满分识别：
```
发现以下数据质量问题：

1. 记录 0: 缺少必填字段 timestamp
2. 记录 1: 缺少必填字段 event_type；timestamp 值 "not-a-number" 不是有效数字
3. 记录 2: event_type 为 null，不是有效的字符串值
```

### 错误处理代码示例

```typescript
// 请求体大小限制
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
let bodySize = 0;

req.on('data', (chunk) => {
  bodySize += chunk.length;
  if (bodySize > MAX_BODY_SIZE) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Request too large',
      message: 'Request body exceeds 1MB limit'
    }));
    req.destroy();
    return;
  }
  body += chunk;
});

req.on('end', () => {
  // JSON 解析
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Invalid JSON',
      message: 'Request body is not valid JSON'
    }));
    return;
  }

  // 字段验证
  if (!data.event_type || typeof data.event_type !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Validation error',
      message: 'event_type is required and must be a string'
    }));
    return;
  }

  if (data.timestamp === undefined || typeof data.timestamp !== 'number') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Validation error',
      message: 'timestamp is required and must be a number'
    }));
    return;
  }

  // 处理有效请求...
});
```

## 评分注意事项

1. 对于数据修复，优先保留有效数据
2. 错误处理应该优雅且不影响服务稳定性
3. 错误信息应该对调试有帮助
4. 允许不同的实现方式，只要效果相同
