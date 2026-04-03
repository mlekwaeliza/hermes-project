const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { csrfProtect } = require('./middleware/csrf');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { queries } = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const leaderRoutes = require('./routes/leader');
const pastorRoutes = require('./routes/pastor');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser (needed for CSRF token validation)
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'church-attendance-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF Protection (for authenticated state-changing requests)
app.use('/api/', csrfProtect());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leader', leaderRoutes);
app.use('/api/pastor', pastorRoutes);

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize default admin if not exists
async function initializeAdmin() {
  try {
    const adminExists = await queries.findUserByUsername('admin');
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const passwordHash = bcrypt.hashSync('admin123', 10);
      await queries.createUser('admin', passwordHash, 'admin', 'System Administrator');
      console.log('Default admin user created');
      console.log('Username: admin');
      console.log('Password: admin123');
      console.log('IMPORTANT: Change this password after first login!');
    }
  } catch (error) {
    console.error('Failed to create admin user:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeAdmin();
});

module.exports = app;
