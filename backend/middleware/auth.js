const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');

const JWT_SECRET = () => process.env.JWT_SECRET || 'minions-secret-key';

function generateToken(userId, expiresIn = '30d') {
  return jwt.sign({ userId }, JWT_SECRET(), { expiresIn });
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = jwt.verify(token, JWT_SECRET());
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isBanned) {
      if (user.bannedUntil && user.bannedUntil < new Date()) {
        await User.findByIdAndUpdate(userId, { isBanned: false, bannedUntil: null });
      } else {
        return res.status(403).json({ error: 'Аккаунт заблокирован', bannedUntil: user.bannedUntil, reason: user.banReason });
      }
    }
    req.userId = userId;
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function adminAuth(req, res, next) {
  await auth(req, res, () => {
    if (!req.user?.isAdmin && !req.user?.isSubAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  });
}

// Admin panel login (separate from user auth)
function adminPanelAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(401).json({ error: 'Admin token required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET() + '_admin');
    if (payload.role !== 'admin') throw new Error();
    req.adminId = payload.adminId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
}

function generateAdminToken() {
  return jwt.sign({ role: 'admin', adminId: 'main' }, JWT_SECRET() + '_admin', { expiresIn: '7d' });
}

module.exports = { generateToken, auth, adminAuth, adminPanelAuth, generateAdminToken };
