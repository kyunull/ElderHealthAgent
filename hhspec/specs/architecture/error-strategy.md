# 错误处理策略：web-frontend

> L1.3 架构设计 — 错误分类、传播与处理

## 1. 错误码体系

### HTTP 状态码映射

| HTTP 状态码 | 错误码 | 场景 | 用户提示 |
|------------|--------|------|---------|
| 400 | `VALIDATION_ERROR` | 请求参数校验失败 | 具体字段错误信息 |
| 401 | `UNAUTHORIZED` | 未登录或 Token 过期 | "登录已过期，请重新登录" |
| 403 | `FORBIDDEN` | 无权访问该资源 | "无权访问该资源" |
| 404 | `NOT_FOUND` | 资源不存在 | "{资源类型}不存在或已被删除" |
| 409 | `CONFLICT` | 用户名已存在等冲突 | "该用户名已被注册" |
| 413 | `FILE_TOO_LARGE` | 上传文件超过大小限制 | "图片大小不能超过 20MB" |
| 415 | `UNSUPPORTED_FORMAT` | 文件格式不支持 | "仅支持 JPG、PNG、PDF 格式" |
| 429 | `RATE_LIMITED` | API 调用频率限制 | "操作太频繁，请稍后再试" |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | "系统错误，请稍后重试" |
| 503 | `SERVICE_UNAVAILABLE` | AI 服务不可用 | "AI 服务暂时不可用，请稍后重试" |
| 504 | `AI_TIMEOUT` | AI API 超时 | "AI 分析超时，请稍后重试" |

### 统一错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": {
      "fields": {
        "drug_name": "药品名称不能为空",
        "start_date": "开始日期格式无效"
      }
    }
  }
}
```

## 2. 各上下文错误处理

### 2.1 Web UI (Vue 3) 错误处理

**全局 Axios 拦截器**：

```typescript
// 响应拦截器
axios.interceptors.response.use(
  response => response,
  error => {
    const { status, data } = error.response || {};

    switch (status) {
      case 401:
        // 清除 Token，跳转登录
        sessionStorage.removeItem('token');
        router.push('/login?expired=true');
        ElMessage.warning('登录已过期，请重新登录');
        break;
      case 403:
        ElMessage.error('无权访问该资源');
        break;
      case 404:
        ElMessage.error(data.error?.message || '资源不存在');
        break;
      case 413:
        ElMessage.error('图片大小不能超过 20MB，请压缩后重试');
        break;
      case 500:
        ElMessage.error('系统错误，请稍后重试');
        break;
      case 503:
      case 504:
        ElMessage.warning(data.error?.message || 'AI 服务暂时不可用');
        break;
      default:
        if (!error.response) {
          ElMessage.error('网络连接失败，请检查服务是否启动');
        }
    }
    return Promise.reject(error);
  }
);
```

**组件级错误处理**：
- 表单组件：每个表单项独立展示校验错误（Element Plus el-form-item error 属性）
- 数据加载：骨架屏 + 错误重试按钮（"加载失败，点击重试"）
- AI 操作：loading 状态 + 超时后显示重试按钮

### 2.2 API Gateway (Express) 错误处理

**错误中间件**：

```typescript
// 全局错误处理中间件
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.userMessage || '系统错误，请稍后重试';

  // 记录详细错误日志（不含敏感信息）
  logger.error({
    code,
    statusCode,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    errorMessage: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    error: {
      code,
      message,
      details: err.details || {},
    },
  });
});
```

**错误分类**：

| 错误类 | 基类 | HTTP 状态码 | 说明 |
|--------|------|-----------|------|
| `ValidationError` | `AppError` | 400 | 请求参数校验失败 |
| `AuthError` | `AppError` | 401 | 认证失败 |
| `ForbiddenError` | `AppError` | 403 | 权限不足 |
| `NotFoundError` | `AppError` | 404 | 资源不存在 |
| `ConflictError` | `AppError` | 409 | 资源冲突 |
| `AITimeoutError` | `AppError` | 504 | AI API 超时 |
| `AIServiceError` | `AppError` | 503 | AI API 调用失败 |

### 2.3 AI 调用容错策略

```
AI API 调用流程:
  ┌─ 第 1 次调用 ──timeout(60s)──> fail?
  │    ├─ 成功 → 返回结果
  │    └─ timeout/5xx → 自动重试 1 次 (exponential backoff: 2s)
  │
  ├─ 第 2 次调用 ──timeout(60s)──> fail?
  │    ├─ 成功 → 返回结果
  │    └─ timeout/5xx → 返回 503/504 错误
  │
  └─ 用户看到"重试"按钮 → 手动重新触发
```

### 2.4 Medical Compute (FastAPI) 错误处理

```python
@app.exception_handler(ComputationError)
async def computation_error_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "COMPUTATION_ERROR",
                "message": str(exc),
                "details": exc.details,
            }
        },
    )

# BFF 调用 FastAPI 失败时降级
async def call_compute_service(endpoint: str, data: dict):
    try:
        response = await http_client.post(
            f"http://localhost:5000{endpoint}",
            json=data,
            timeout=10.0,
        )
        return response.json()
    except (ConnectionError, TimeoutError):
        # 降级：跳过高级计算
        logger.warning(f"FastAPI unavailable for {endpoint}, degrading")
        return None
```

### 2.5 SQLite 错误处理

```typescript
// WAL 模式下的忙等待 + 最终降级
function executeWithRetry<T>(db: Database, fn: () => T, maxRetries = 3): T {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return fn();
    } catch (err) {
      if (err.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
        // WAL 模式下等待 100ms 后重试
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      throw new AppError(503, 'SERVICE_UNAVAILABLE', '系统繁忙，请稍后重试');
    }
  }
}
```

## 3. 前端错误状态展示规范

| 场景 | 展示方式 | 组件 |
|------|---------|------|
| 列表加载失败 | 错误提示 + "重新加载"按钮 | el-empty + el-button |
| 表单校验失败 | 字段下方红色错误文字 | el-form-item error |
| AI 处理超时 | 橙色提示框 + "重试"按钮 | el-alert type="warning" |
| 网络断开 | 全局顶部横幅提示 | el-alert type="error" (fixed top) |
| 权限不足 | 403 页面 | el-result status="403" |
| 页面不存在 | 404 页面 | el-result status="404" |
| 首次使用引导 | 空状态插图 + 引导按钮 | el-empty + description |

## 4. 日志规范

| 级别 | 场景 | 示例 |
|------|------|------|
| `ERROR` | 服务器异常、AI API 失败、数据库写入失败 | `[ERROR] AI extraction failed for report #42: timeout after 60s` |
| `WARN` | 校验失败、资源未找到、降级启用 | `[WARN] FastAPI unavailable, trend analysis degraded` |
| `INFO` | 用户操作、AI 调用开始、数据迁移 | `[INFO] User 'alice' uploaded report #42 (biochemical)` |
| `DEBUG` | 开发调试信息 | `[DEBUG] Query: SELECT * FROM reports WHERE user_id=?` |
