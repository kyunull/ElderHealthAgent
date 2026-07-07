export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.userMessage || '系统错误，请稍后重试';

  console.error(`[ERROR] ${req.method} ${req.path} — ${code}: ${err.message}`);

  res.status(statusCode).json({
    error: { code, message, details: err.details || {} }
  });
}

export class AppError extends Error {
  constructor(statusCode, code, userMessage, details = {}) {
    super(userMessage);
    this.statusCode = statusCode;
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }

  static validation(fieldErrors) {
    return new AppError(400, 'VALIDATION_ERROR', '请求参数校验失败', { fields: fieldErrors });
  }

  static auth(message = '请先登录') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden() {
    return new AppError(403, 'FORBIDDEN', '无权访问该资源');
  }

  static notFound(resource = '资源') {
    return new AppError(404, 'NOT_FOUND', `${resource}不存在或已被删除`);
  }

  static conflict(message) {
    return new AppError(409, 'CONFLICT', message);
  }

  static aiTimeout() {
    return new AppError(504, 'AI_TIMEOUT', 'AI 分析超时，请稍后重试');
  }

  static aiUnavailable() {
    return new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'AI 服务暂时不可用，请稍后重试');
  }

  static apiKeyRequired() {
    return new AppError(400, 'API_KEY_REQUIRED', '请先在设置页面配置 API Key');
  }
}
