import { Router } from 'express';
import { getDb } from '../database.js';

const router = Router();

// Get ASR config (API key masked)
router.get('/config', (req, res, next) => {
  try {
    const db = getDb();
    const keys = ['asr_provider', 'asr_app_id', 'asr_api_key', 'asr_secret_key'];
    const result = {};
    for (const key of keys) {
      const row = db.prepare('SELECT config_value FROM system_config WHERE config_key = ?').get(key);
      result[key] = row?.config_value || null;
    }
    res.json({
      provider: result.asr_provider || 'web-speech',
      app_id: result.asr_app_id || '',
      api_key_configured: !!result.asr_api_key,
      secret_key_configured: !!result.asr_secret_key
    });
  } catch (err) { next(err); }
});

// Save ASR config
router.put('/config', (req, res, next) => {
  try {
    const db = getDb();
    const { provider, app_id, api_key, secret_key } = req.body;

    const upsert = (key, val) => {
      if (!val) return;
      const existing = db.prepare('SELECT id FROM system_config WHERE config_key = ?').get(key);
      if (existing) {
        db.prepare('UPDATE system_config SET config_value = ?, updated_at = datetime("now") WHERE config_key = ?').run(val, key);
      } else {
        db.prepare('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)').run(key, val);
      }
    };

    if (provider) upsert('asr_provider', provider);
    if (app_id !== undefined) upsert('asr_app_id', app_id);
    if (api_key) {
      const encoded = Buffer.from(api_key).toString('base64');
      upsert('asr_api_key', encoded);
    }
    if (secret_key) {
      const encoded = Buffer.from(secret_key).toString('base64');
      upsert('asr_secret_key', encoded);
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Delete ASR config
router.delete('/config', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM system_config WHERE config_key LIKE 'asr_%'").run();
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
