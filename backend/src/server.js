import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadRoutes from './routes/upload.js';
import testRoutes from './routes/tests.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import prisma from './config/database.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'SAT Buddy API is running',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/tests', testRoutes);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   SAT Buddy API Server                ║
║   Running on http://localhost:${PORT}   ║
║   Using Gemini 3 Flash Preview        ║
╚═══════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

export default app;
