# L2 测试骨架：web-frontend

> L2 Test Designer — 多层测试 AAA 骨架

## 测试分层

| 层 | 范围 | 框架 | Mock 策略 |
|----|------|------|----------|
| 1. Unit | Repository/Service 纯函数 | Vitest | 允许 I/O 边界 stub |
| 2. Integration (模块内) | Express 路由 + Repository | Vitest + supertest | SQLite 内存数据库 |
| 3. Integration (模块间) | Express ↔ FastAPI | Vitest | FastAPI mock server |
| 4. E2E | 完整请求流 | Playwright | 真实服务 |
| 5. Contract | API 契约 | Vitest | OpenAPI schema 校验 |
| 6. Resilience | 超时/降级/重试 | Vitest | 模拟故障注入 |

## 测试骨架

### 1. 单元测试

```typescript
// tests/unit/repositories/user.repository.test.ts
describe('UserRepository', () => {
  describe('findByUsername', () => {
    it('returns user when username exists', () => {
      // Arrange: 插入测试用户
      const user = repo.create({ username: 'test', ... });
      // Act: 查询
      const result = repo.findByUsername('test');
      // Assert: 找到用户，password_hash 存在
      expect(result).not.toBeNull();
      expect(result.username).toBe('test');
    });

    it('returns null when username does not exist', () => {
      // Arrange: 空数据库
      // Act: 查询不存在用户
      const result = repo.findByUsername('nonexistent');
      // Assert: null
      expect(result).toBeNull();
    });
  });
});

// tests/unit/services/auth.service.test.ts
describe('AuthService', () => {
  describe('login', () => {
    it('returns token and user on valid credentials', () => { /* AAA */ });
    it('throws AuthError on wrong password', () => { /* AAA */ });
    it('throws AuthError on nonexistent user', () => { /* AAA */ });
  });
  describe('register', () => {
    it('creates user with hashed password', () => { /* AAA */ });
    it('throws ConflictError on duplicate username', () => { /* AAA */ });
  });
});
```

### 2. 集成测试 (模块内)

```typescript
// tests/integration/auth.routes.test.ts
describe('POST /api/auth/login', () => {
  it('returns 200 with token on valid login', async () => {
    // Arrange: 预先创建用户
    await request(app).post('/api/auth/register').send({...});
    // Act: 登录
    const res = await request(app).post('/api/auth/login').send({
      username: 'test', password: 'password123'
    });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('test');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'test', password: 'wrong'
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// tests/integration/reports.routes.test.ts
describe('POST /api/reports/upload', () => {
  it('returns 400 when API Key not configured', () => { /* AAA */ });
  it('returns 201 with report on successful upload', () => { /* AAA */ });
  it('returns 413 when file exceeds 20MB', () => { /* AAA */ });
  it('returns 415 when file format unsupported', () => { /* AAA */ });
});

describe('GET /api/reports/:id', () => {
  it('returns 403 when accessing another user report', () => { /* AAA */ });
  it('returns 404 when report not found', () => { /* AAA */ });
  it('returns report with indicators for biochemical type', () => { /* AAA */ });
});
```

### 3. 模块间集成测试

```typescript
// tests/integration/compute.integration.test.ts
describe('Trend API ↔ FastAPI integration', () => {
  it('returns trend data when FastAPI is available', async () => { /* AAA */ });
  it('returns degraded trend data when FastAPI is down', async () => {
    // Arrange: 关闭 FastAPI mock
    // Act: 请求趋势
    // Assert: 200 + warning 字段
  });
});
```

### 4. E2E 测试 (Playwright)

```typescript
// tests/e2e/auth-flow.spec.ts
test('user can register and login', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('text=注册新账户');
  await page.fill('[name=username]', 'testuser');
  await page.fill('[name=display_name]', 'Test User');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/dashboard/);
});

// tests/e2e/report-upload.spec.ts
test('upload biochemical report and view results', async ({ page }) => { /* AAA */ });

// tests/e2e/cga-assessment.spec.ts
test('complete CGA assessment and get AI analysis', async ({ page }) => { /* AAA */ });

// tests/e2e/cognitive-screening.spec.ts
test('complete MMSE screening and see trend', async ({ page }) => { /* AAA */ });
```

### 5. 契约测试

```typescript
// tests/contract/api-contracts.test.ts
describe('API Contract validation', () => {
  it('POST /api/auth/login response matches schema', async () => {
    const res = await request(app).post('/api/auth/login').send({...});
    expect(res.body).toMatchSchema('AuthResponse');
  });
  // 对每个端点验证 response schema
});
```

### 6. 韧性测试

```typescript
// tests/resilience/ai-timeout.test.ts
describe('AI timeout handling', () => {
  it('retries once on Anthropic API timeout', async () => {
    // Arrange: mock API 第一次 timeout，第二次成功
    // Act: 触发 AI 分析
    // Assert: 返回成功，只调用了 2 次 API
  });

  it('returns 504 after all retries exhausted', async () => {
    // Arrange: mock API 始终 timeout
    // Act: 触发 AI 分析
    // Assert: 返回 504，status='failed'
  });
});

// tests/resilience/sqlite-busy.test.ts
describe('SQLite WAL busy handling', () => {
  it('retries on SQLITE_BUSY up to 3 times', () => { /* AAA */ });
});
```

## 业务流 DAG

```
Auth Flow:
  register ──> login ──> dashboard

Report Flow:
  upload ──> ai_extraction ──> review ──> confirm ──> query

Consultation Flow:
  select_type ──> fill_complaint ──> submit ──> ai_analysis ──> view_result

CGA Flow:
  create ──> fill_dimensions (parallel) ──> submit ──> ai_analysis ──> view_report

Cognitive Flow:
  select_tool ──> fill_questionnaire ──> auto_score ──> ai_analysis ──> view_trend
```

## flow_groups (并行测试组)

```yaml
groups:
  - name: auth
    tests: [auth-flow.spec.ts]
    parallel: false  # 登录是其他测试的前置

  - name: reports
    tests: [report-upload.spec.ts, report-query.spec.ts]
    parallel: true

  - name: medications
    tests: [medication-crud.spec.ts, interaction-check.spec.ts]
    parallel: true

  - name: consultations
    tests: [specialist-consult.spec.ts, mdt-consult.spec.ts]
    parallel: true

  - name: elderly
    tests: [cga-assessment.spec.ts, cognitive-screening.spec.ts]
    parallel: true
```
