const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { checkSupabaseConnection } = require('./config/supabase');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Trust reverse proxy (needed for Vercel rate limiting and secure headers)
app.set('trust proxy', 1);

// Initialize & verify Supabase PostgreSQL connection
checkSupabaseConnection();

// CORS configuration
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter for authentication endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes'
  }
});

// Mount API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Task Manager API is running smoothly',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static assets from public/
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Clean URL routing for multi-page architecture
app.get('/login', (req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(publicDir, 'register.html'));
});
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});
app.get('/tasks', (req, res) => {
  res.sendFile(path.join(publicDir, 'tasks.html'));
});
app.get('/calendar', (req, res) => {
  res.sendFile(path.join(publicDir, 'calendar.html'));
});
app.get('/profile', (req, res) => {
  res.sendFile(path.join(publicDir, 'profile.html'));
});

// Fallback for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`
  });
});

// Fallback to index.html for root or client navigation
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;
if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Task Manager Server running on port ${PORT}`);
    console.log(`🌐 Web App: http://localhost:${PORT}`);
    console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    console.log(`===============================================`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Error: ${err.message}`);
});

module.exports = { app, server };
