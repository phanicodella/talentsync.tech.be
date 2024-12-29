// backend/src/utils/logging.util.js
const winston = require('winston');
const path = require('path');

class LoggingUtil {
    constructor() {
        const logFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json()
        );

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            transports: [
                // Console transport
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                
                // File transport for errors
                new winston.transports.File({
                    filename: path.join(__dirname, '../logs/error.log'),
                    level: 'error'
                }),
                
                // File transport for combined logs
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../logs/combined.log') 
                })
            ]
        });

        // Add file transport only in production
        if (process.env.NODE_ENV === 'production') {
            this.logger.add(new winston.transports.File({
                filename: path.join(__dirname, '../logs/production.log'),
                level: 'info'
            }));
        }
    }

    // Log application events
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    // Log warnings
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    // Log errors
    error(message, error = null) {
        if (error instanceof Error) {
            this.logger.error(message, { 
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
        } else {
            this.logger.error(message);
        }
    }

    // Log debug information (only in development)
    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            this.logger.debug(message, meta);
        }
    }

    // Audit logging for security-critical actions
    audit(action, user, details = {}) {
        this.logger.info('AUDIT', {
            action,
            userId: user._id,
            userEmail: user.email,
            timestamp: new Date().toISOString(),
            details
        });
    }
}

module.exports = new LoggingUtil();