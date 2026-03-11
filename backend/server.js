require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20 });
app.use('/api/auth/', authLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/deals',      require('./routes/deals'));
app.use('/api/wallet',     require('./routes/wallet'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/admin',      require('./routes/admin'));

// ── Static frontend ────────────────────────────────────────────────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

// ── Database ───────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/minions', {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');

  // Start Telegram bot
  require('./utils/bot').getBot();

  // Start server
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Minions Market server running on port ${PORT}`));
}).catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// ── Cron: auto-complete deals after 72h ───────────────────────────────────────
const cron = require('node-cron');
cron.schedule('*/30 * * * *', async () => {
  try {
    const Deal = require('./models/Deal');
    const expired = await Deal.find({ status:'active', autoCompleteAt:{ $lte:new Date() } }).populate('buyer seller product');
    for (const deal of expired) {
      console.log(`Auto-completing deal ${deal._id}`);
      // Import completeDeal logic inline
    }
  } catch(e) { console.error('Cron error:', e.message); }
});

module.exports = app;
