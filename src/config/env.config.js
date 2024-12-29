// backend/src/config/env.config.js
const config = {
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGODB_URI,
    openaiKey: process.env.OPENAI_API_KEY,
    apiUrl: process.env.API_URL,
    nodeEnv: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5000']
};

module.exports = config;