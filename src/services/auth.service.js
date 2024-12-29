// backend/src/services/auth.service.js
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const config = require('../config/env.config');
const EmailService = require('./email.service');
const EncryptionUtil = require('../utils/encryption.util');

class AuthService {
    async registerUser(userData) {
        const { email, password, firstName, lastName, role } = userData;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create new user
        const user = new User({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role: role || 'interviewer'
        });

        await user.save();

        // Generate token
        const token = this.generateToken(user);

        return {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            },
            token
        };
    }

    async loginUser(email, password) {
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Check if account is locked
        if (user.isLocked()) {
            throw new Error('Account is temporarily locked');
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
            // Increment login attempts
            await user.incrementLoginAttempts();
            throw new Error('Invalid credentials');
        }

        // Reset login attempts on successful login
        user.loginAttempts = 0;
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = this.generateToken(user);

        return {
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            },
            token
        };
    }

    generateToken(user) {
        return jwt.sign(
            { 
                id: user._id,
                email: user.email,
                role: user.role 
            },
            config.jwtSecret,
            { expiresIn: '24h' }
        );
    }

    async initiatePasswordReset(email) {
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            // Prevent email enumeration
            return { success: true, message: 'If an account exists, a reset link will be sent' };
        }

        // Generate reset token
        const resetToken = EncryptionUtil.generateToken();
        
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send reset email
        await EmailService.sendPasswordResetEmail(user, resetToken);

        return { 
            success: true, 
            message: 'Password reset link sent to your email' 
        };
    }

    async resetPassword(token, newPassword) {
        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        // Update password
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return { 
            success: true, 
            message: 'Password has been reset successfully' 
        };
    }
}

module.exports = new AuthService();