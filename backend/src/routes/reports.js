import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { getDb } from '../database.js';
import { AppError } from '../middleware/error-handler.js';
import { performAIExtraction } from '../services/ai-extraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'data', 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const userDir = path.join(UPLOADS_DIR, String(req.user.id));
      fs.mkdirSync(userDir, { recursive: true });
      cb(null, userDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new AppError(415, 'UNSUPPORTED_FORMAT', '仅支持 JPG、PNG、PDF 格式'));
  }
});

const router = Router();

router.post('/upload', upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) throw AppError.validation({ image: '请选择检查单图片' });
    const { report_date, report_type, hospital_name, department } = req.body;

    if (!report_date || !report_type) {
      throw AppError.validation({ form: '报告日期和检查类型为必填项' });
    }
    if (!['biochemical', 'imaging'].includes(report_type)) {
      throw AppError.validation({ report_type: '检查类型无效' });
    }

    const db = getDb();
    const apiKey = db.prepare('SELECT api_key_encrypted FROM users WHERE id = ?').get(req.user.id);
    if (!apiKey?.api_key_encrypted) throw AppError.apiKeyRequired();

    // Relative path from project root
    const relPath = path.relative(PROJECT_ROOT, req.file.path).replace(/\\/g, '/');
    const result = db.prepare(
      `INSERT INTO health_reports (user_id, report_type, title, report_date, hospital_name, department, original_image_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')`
    ).run(req.user.id, report_type, req.file.originalname, report_date, hospital_name || null, department || null, relPath);

    // Async AI extraction
    setImmediate(() => {
      performAIExtraction(req.file.path, report_type, result.lastInsertRowid, req.user.id);
    });

    res.status(201).json({
      id: result.lastInsertRowid,
      status: 'uploaded',
      title: req.file.originalname,
      image_url: `/api/images/${req.user.id}/${req.file.filename}`
    });
  } catch (err) { next(err); }
});

router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const { report_type, start_date, end_date, status, page = 1, limit = 20 } = req.query;

    let baseQ = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (report_type) { baseQ += ' AND report_type = ?'; params.push(report_type); }
    if (start_date) { baseQ += ' AND report_date >= ?'; params.push(start_date); }
    if (end_date) { baseQ += ' AND report_date <= ?'; params.push(end_date); }
    if (status) { baseQ += ' AND status = ?'; params.push(status); }

    const { total } = db.prepare(`SELECT COUNT(*) as total FROM health_reports ${baseQ}`).get(...params);
    const data = db.prepare(
      `SELECT id, user_id, report_type, title, report_date, hospital_name, department, original_image_path, ai_processed, status, created_at
       FROM health_reports ${baseQ} ORDER BY report_date DESC LIMIT ? OFFSET ?`
    ).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

    // Add image URL for thumbnail
    for (const row of data) {
      if (row.original_image_path) {
        const filename = path.basename(row.original_image_path);
        row.image_url = `/api/images/${row.user_id}/${filename}`;
      }
    }

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const report = db.prepare('SELECT * FROM health_reports WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!report) throw AppError.notFound('报告');

    // Add image URL
    if (report.original_image_path) {
      const filename = path.basename(report.original_image_path);
      report.image_url = `/api/images/${report.user_id}/${filename}`;
    }

    if (report.report_type === 'biochemical') {
      report.indicators = db.prepare('SELECT * FROM biochemical_indicators WHERE report_id = ?').all(report.id);
    } else {
      report.findings = db.prepare('SELECT * FROM imaging_findings WHERE report_id = ?').all(report.id);
    }

    res.json(report);
  } catch (err) { next(err); }
});

router.put('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const report = db.prepare('SELECT id FROM health_reports WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!report) throw AppError.notFound('报告');

    const { title, indicators } = req.body;
    if (title) {
      db.prepare('UPDATE health_reports SET title = ? WHERE id = ?').run(title, report.id);
    }
    if (indicators && Array.isArray(indicators)) {
      for (const ind of indicators) {
        if (ind.id) {
          db.prepare('UPDATE biochemical_indicators SET value = ?, indicator_name = COALESCE(?, indicator_name) WHERE id = ? AND report_id = ?')
            .run(ind.value, ind.indicator_name, ind.id, report.id);
        }
      }
    }

    db.prepare("UPDATE health_reports SET status = 'confirmed' WHERE id = ?").run(report.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const report = db.prepare('SELECT id FROM health_reports WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!report) throw AppError.notFound('报告');
    db.prepare('DELETE FROM health_reports WHERE id = ?').run(report.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
