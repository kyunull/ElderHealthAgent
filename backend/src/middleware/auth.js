import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'wellally-dev-secret-change-in-production';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '请先登录' }
    });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, username: payload.username, role: payload.role };
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '登录已过期，请重新登录' }
    });
  }
}

export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}
