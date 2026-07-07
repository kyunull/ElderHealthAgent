import { Router } from 'express';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

// Check profile completeness
router.get('/check', (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT height_cm, weight_kg, birth_date, gender, blood_type, display_name FROM users WHERE id = ?').get(req.user.id);

    const reportCount = db.prepare('SELECT COUNT(*) as count FROM health_reports WHERE user_id = ?').get(req.user.id);
    const apiKey = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(req.user.id);

    const profileFields = { height: !!user?.height_cm, weight: !!user?.weight_kg, birth: !!user?.birth_date, gender: !!user?.gender };
    const profileComplete = Object.values(profileFields).every(Boolean);

    res.json({
      profile_complete: profileComplete,
      profile_fields: profileFields,
      has_reports: reportCount.count > 0,
      report_count: reportCount.count,
      has_api_key: !!apiKey?.api_key_encrypted,
      steps: {
        profile: { done: profileComplete, label: '完善个人档案', link: '/profile' },
        api_key: { done: !!apiKey?.api_key_encrypted, label: '配置 AI API Key', link: '/settings' },
        upload: { done: reportCount.count > 0, label: '上传第一份检查单', link: '/reports/upload' }
      }
    });
  } catch (err) { next(err); }
});

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, display_name, role, height_cm, weight_kg, birth_date, gender, blood_type FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (err) { next(err); }
});

router.put('/', (req, res, next) => {
  try {
    const { display_name, height_cm, weight_kg, birth_date, gender, blood_type } = req.body;
    const db = getDb();
    db.prepare(
      `UPDATE users SET display_name = COALESCE(?, display_name), height_cm = COALESCE(?, height_cm),
       weight_kg = COALESCE(?, weight_kg), birth_date = COALESCE(?, birth_date),
       gender = COALESCE(?, gender), blood_type = COALESCE(?, blood_type), updated_at = datetime('now')
       WHERE id = ?`
    ).run(display_name || null, height_cm ?? null, weight_kg ?? null, birth_date || null, gender || null, blood_type || null, req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Allergies sub-routes
router.get('/allergies', (req, res, next) => {
  try {
    const db = getDb();
    const allergies = db.prepare('SELECT * FROM allergies WHERE user_id = ? ORDER BY recorded_at DESC').all(req.user.id);
    res.json(allergies);
  } catch (err) { next(err); }
});

router.post('/allergies', (req, res, next) => {
  try {
    const { allergen, severity, reaction } = req.body;
    if (!allergen || !severity) throw AppError.validation({ form: '过敏原和严重程度为必填项' });
    const db = getDb();
    const result = db.prepare('INSERT INTO allergies (user_id, allergen, severity, reaction) VALUES (?, ?, ?, ?)').run(req.user.id, allergen, severity, reaction || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) { next(err); }
});

router.put('/allergies/:id', (req, res, next) => {
  try {
    const db = getDb();
    const allergy = db.prepare('SELECT id FROM allergies WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!allergy) throw AppError.notFound('过敏记录');
    const { allergen, severity, reaction } = req.body;
    db.prepare('UPDATE allergies SET allergen = COALESCE(?, allergen), severity = COALESCE(?, severity), reaction = COALESCE(?, reaction) WHERE id = ?')
      .run(allergen || null, severity || null, reaction || null, allergy.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/allergies/:id', (req, res, next) => {
  try {
    const db = getDb();
    const allergy = db.prepare('SELECT id FROM allergies WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!allergy) throw AppError.notFound('过敏记录');
    db.prepare('DELETE FROM allergies WHERE id = ?').run(allergy.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
