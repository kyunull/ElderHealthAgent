import { Router } from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../database.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';

const router = Router();

router.post('/register', (req, res, next) => {
  try {
    const { username, display_name, password } = req.body;

    if (!username || username.length < 3 || username.length > 50 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      throw AppError.validation({ username: '用户名需为3-50位字母、数字或下划线' });
    }
    if (!display_name || display_name.trim().length === 0) {
      throw AppError.validation({ display_name: '显示名称不能为空' });
    }
    if (!password || password.length < 6) {
      throw AppError.validation({ password: '密码至少6位' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) throw AppError.conflict('该用户名已被注册');

    const password_hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
    ).run(username, password_hash, display_name.trim());

    const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    res.status(201).json({ token, user: { ...user, api_key_configured: false } });
  } catch (err) { next(err); }
});

router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) throw AppError.validation({ form: '用户名和密码不能为空' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw new AppError(401, 'UNAUTHORIZED', '用户名或密码错误');
    }

    const token = generateToken(user);
    const { password_hash, api_key_encrypted, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, api_key_configured: !!api_key_encrypted } });
  } catch (err) { next(err); }
});

router.get('/me', authMiddleware, (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, display_name, role, height_cm, weight_kg, birth_date, gender, blood_type, api_key_encrypted, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw AppError.notFound('用户');
    const { api_key_encrypted, ...safeUser } = user;
    res.json({ ...safeUser, api_key_configured: !!api_key_encrypted });
  } catch (err) { next(err); }
});

export default router;
