import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Read Claude Code config from standard locations
function readClaudeConfig() {
  const paths = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(process.cwd(), '.claude', 'settings.local.json'),
    path.join(os.homedir(), '.claude', 'settings.local.json'),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    } catch { /* skip unreadable files */ }
  }
  return null;
}

function extractApiConfig(config) {
  if (!config) return null;
  const env = config.env || {};
  const result = {};
  if (env.ANTHROPIC_AUTH_TOKEN) result.apiKey = env.ANTHROPIC_AUTH_TOKEN;
  if (env.ANTHROPIC_BASE_URL) result.baseUrl = env.ANTHROPIC_BASE_URL;
  if (env.ANTHROPIC_MODEL) result.model = env.ANTHROPIC_MODEL;
  return Object.keys(result).length > 0 ? result : null;
}

// Auto-configure from Claude Code settings
router.get('/api-key/auto-config', (req, res, next) => {
  try {
    const config = readClaudeConfig();
    const apiConfig = extractApiConfig(config);

    if (!apiConfig?.apiKey) {
      return res.json({
        configured: false,
        message: '未找到 Claude Code 配置文件中的 API Key，请手动配置',
        source: config ? 'settings.json found but no ANTHROPIC_AUTH_TOKEN' : 'no settings.json found'
      });
    }

    const db = getDb();
    const encrypted = Buffer.from(apiConfig.apiKey).toString('base64');
    db.prepare("UPDATE users SET api_key_encrypted = ?, updated_at = datetime('now') WHERE id = ?").run(encrypted, req.user.id);

    // Also store base URL and model in system_config
    const upsertConfig = db.prepare(
      'INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = datetime(\'now\')'
    );
    if (apiConfig.baseUrl) upsertConfig.run('anthropic_base_url', apiConfig.baseUrl, 'Anthropic API 基础 URL');
    if (apiConfig.model) upsertConfig.run('anthropic_model', apiConfig.model, 'Anthropic 模型名称');

    res.json({
      configured: true,
      source: 'Claude Code settings.json',
      model: apiConfig.model || 'default',
      message: `已自动从 Claude Code 配置加载 API Key (模型: ${apiConfig.model || 'default'})`
    });
  } catch (err) { next(err); }
});

// Check auto-config availability without applying
router.get('/api-key/check-config', (req, res) => {
  const config = readClaudeConfig();
  const apiConfig = extractApiConfig(config);
  res.json({
    available: !!apiConfig?.apiKey,
    source: config ? 'settings.json' : null,
    model: apiConfig?.model || null,
    baseUrl: apiConfig?.baseUrl || null
  });
});

router.put('/api-key', (req, res, next) => {
  try {
    const { api_key } = req.body;
    if (!api_key || api_key.trim().length === 0) throw AppError.validation({ api_key: 'API Key 不能为空' });

    const db = getDb();
    const encrypted = Buffer.from(api_key.trim()).toString('base64');
    db.prepare("UPDATE users SET api_key_encrypted = ?, updated_at = datetime('now') WHERE id = ?").run(encrypted, req.user.id);
    res.json({ success: true, message: 'API Key 已保存' });
  } catch (err) { next(err); }
});

router.post('/api-key/verify', (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(req.user.id);
    if (!user?.api_key_encrypted) {
      // Check if auto-config is available
      const config = readClaudeConfig();
      const apiConfig = extractApiConfig(config);
      if (apiConfig?.apiKey) {
        return res.json({
          valid: false,
          message: '检测到 Claude Code 配置文件中有可用 API Key，是否自动加载？',
          autoConfigAvailable: true
        });
      }
      throw AppError.validation({ api_key: '请先配置 API Key' });
    }

    res.json({ valid: true, message: 'API Key 已配置' });
  } catch (err) { next(err); }
});

// Get current AI config status for frontend display
router.get('/api-key/status', (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(req.user.id);
    const model = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_model'").get();
    const baseUrl = db.prepare("SELECT config_value FROM system_config WHERE config_key = 'anthropic_base_url'").get();

    res.json({
      configured: !!user?.api_key_encrypted,
      model: model?.config_value || null,
      baseUrl: baseUrl?.config_value || null
    });
  } catch (err) { next(err); }
});

// ── OCR Model Configuration ──

router.get('/ocr-config', (req, res, next) => {
  try {
    const db = getDb();
    const keys = ['ocr_api_url', 'ocr_api_key', 'ocr_model', 'ocr_provider'];
    const config = {};
    for (const key of keys) {
      const row = db.prepare('SELECT config_value FROM system_config WHERE config_key = ?').get(key);
      config[key] = row?.config_value || null;
    }
    // Don't return the actual key, just whether it's configured
    res.json({
      provider: config.ocr_provider || null,
      model: config.ocr_model || null,
      api_url: config.ocr_api_url || null,
      api_key_configured: !!config.ocr_api_key
    });
  } catch (err) { next(err); }
});

router.put('/ocr-config', (req, res, next) => {
  try {
    const { provider, model, api_url, api_key } = req.body;
    const db = getDb();
    const upsert = db.prepare(
      'INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = datetime(\'now\')'
    );
    if (provider) upsert.run('ocr_provider', provider, 'OCR 服务提供商');
    if (model) upsert.run('ocr_model', model, 'OCR 模型名称');
    if (api_url) upsert.run('ocr_api_url', api_url, 'OCR API 地址');
    if (api_key) {
      const encrypted = Buffer.from(api_key).toString('base64');
      upsert.run('ocr_api_key', encrypted, 'OCR API Key（加密存储）');
    }
    res.json({ success: true, message: 'OCR 配置已保存' });
  } catch (err) { next(err); }
});

router.delete('/ocr-config', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM system_config WHERE config_key LIKE 'ocr_%'").run();
    res.json({ success: true, message: 'OCR 配置已清除' });
  } catch (err) { next(err); }
});

export default router;
