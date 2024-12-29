const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db.config');
const WebSocketService = require('./services/websocket.service');
const { errorMiddleware } = require('./middleware/error.middleware');
const logger = require('./utils/logging.utils');

// Load env vars
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket service
const webSocketService = new WebSocketService(server);

// Connect to database
connectDB();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Due to WebSocket connections
    crossOriginEmbedderPolicy: false // For file uploads
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000', 'http://localhost:5000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Interview-Token'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// Import routes
const authRoutes = require('./routes/auth.routes');
const interviewRoutes = require('./routes/interview.routes');
const interviewSessionRoutes = require('./routes/interviewSession.routes');
const configRoutes = require('./routes/configRoutes');
const openaiRoutes = require('./routes/openai.routes');
const userRoutes = require('./routes/user.routes');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/sessions', interviewSessionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/users', userRoutes);

// Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        status: 'fail',
        message: `Route ${req.originalUrl} not found`
    });
});

// Error handling middleware
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        pid: process.pid
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Perform graceful shutdown
    shutdownServer('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
    // Perform graceful shutdown
    shutdownServer('UNHANDLED_REJECTION');
});

// Graceful shutdown handler
async function shutdownServer(signal) {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Close WebSocket connections
    if (webSocketService) {
        logger.info('Closing WebSocket connections...');
        webSocketService.shutdown();
    }

    // Close HTTP server
    server.close(() => {
        logger.info('HTTP server closed.');
        
        // Close database connection
        mongoose.connection.close(false, () => {
            logger.info('Database connection closed.');
            process.exit(1);
        });
    });

    // Force close after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Handle termination signals
const signals = ['SIGTERM', 'SIGINT'];
signals.forEach(signal => {
    process.on(signal, () => {
        logger.info(`${signal} signal received`);
        shutdownServer(signal);
    });
});

module.exports = {
    app,
    server,
    webSocketService
};