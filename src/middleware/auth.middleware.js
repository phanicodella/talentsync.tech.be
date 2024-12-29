// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

class AuthMiddleware {
    // JWT generation utility
    generateToken(user) {
        return jwt.sign(
            { 
                id: user._id, 
                email: user.email, 
                role: user.role 
            }, 
            process.env.JWT_SECRET, 
            { 
                expiresIn: '24h' 
            }
        );
    }

    // Authentication middleware
    async authenticateUser(req, res, next) {
        try {
            // Extract token from header
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'No authentication token provided' });
            }

            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({ error: 'Invalid token format' });
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find user and attach to request
            const user = await User.findById(decoded.id)
                .select('-password')
                .lean();

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            // Attach user to request object
            req.user = {
                _id: user._id,
                email: user.email,
                role: user.role
            };

            next();
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            console.error('Authentication error:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    }

    // Admin-only access middleware
    requireAdmin(req, res, next) {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied', 
                message: 'Administrator privileges required' 
            });
        }
        next();
    }

    // Role-based access control
    checkRoles(roles) {
        return (req, res, next) => {
            if (!req.user || !roles.includes(req.user.role)) {
                return res.status(403).json({ 
                    error: 'Access denied', 
                    message: 'Insufficient privileges' 
                });
            }
            next();
        };
    }

    // Token refresh utility
    async refreshToken(user) {
        // Generate new token
        const newToken = this.generateToken(user);
        
        // Optional: Implement token rotation or blacklisting logic
        return {
            token: newToken,
            expiresIn: '24h'
        };
    }
}

module.exports = new AuthMiddleware();