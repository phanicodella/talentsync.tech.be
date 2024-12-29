// backend/src/utils/rate-limiter.util.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

class RateLimiterUtil {
    constructor() {
        // Redis connection for distributed rate limiting
        this.redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        });
    }

    // Generic rate limiter
    createLimiter(options = {}) {
        const defaultOptions = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            standardHeaders: true, // Return rate limit info in RateLimit-* headers
            legacyHeaders: false, // Disable X-RateLimit-* headers
            message: 'Too many requests, please try again later',
            store: new RedisStore({
                sendCommand: (...args) => this.redisClient.call(...args)
            })
        };

        return rateLimit({
            ...defaultOptions,
            ...options
        });
    }

    // Specific limiters for different routes
    loginLimiter() {
        return this.createLimiter({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 login attempts per 15 minutes
            message: 'Too many login attempts, please try again later'
        });
    }

    apiLimiter() {
        return this.createLimiter({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 500, // 500 requests per 15 minutes
            message: 'Too many API requests, please try again later'
        });
    }

    createAccountLimiter() {
        return this.createLimiter({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 5, // 5 account creations per hour
            message: 'Too many accounts created, please try again later'
        });
    }

    // Cleanup method
    async close() {
        await this.redisClient.quit();
    }
}

module.exports = new RateLimiterUtil();