// backend/src/controllers/auth.controller.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/error.middleware');
const config = require('../config/env.config');

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id,
            email: user.email,
            role: user.role 
        },
        config.jwtSecret,
        { expiresIn: '24h' }
    );
};

// Register new user
const register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ApiError('User already exists with this email', 400);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            role: role || 'interviewer'
        });

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// Login user
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            throw new ApiError('Invalid credentials', 401);
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new ApiError('Invalid credentials', 401);
        }

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get current user
const getCurrentUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            throw new ApiError('User not found', 404);
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// Update user profile
const updateProfile = async (req, res, next) => {
    try {
        const { firstName, lastName, currentPassword, newPassword } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            throw new ApiError('User not found', 404);
        }

        // Update basic info
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;

        // Update password if provided
        if (currentPassword && newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                throw new ApiError('Current password is incorrect', 400);
            }

            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
        }

        await user.save();

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
};

// Request password reset
const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Still return success to prevent email enumeration
            return res.json({ success: true, message: 'If your email exists, you will receive a reset link' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { id: user._id },
            config.jwtSecret,
            { expiresIn: '1h' }
        );

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // TODO: Send reset email with token

        res.json({
            success: true,
            message: 'If your email exists, you will receive a reset link'
        });
    } catch (error) {
        next(error);
    }
};

// Reset password with token
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        // Verify token
        const decoded = jwt.verify(token, config.jwtSecret);
        
        const user = await User.findOne({
            _id: decoded.id,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            throw new ApiError('Invalid or expired reset token', 400);
        }

        // Update password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Password has been reset successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    getCurrentUser,
    updateProfile,
    requestPasswordReset,
    resetPassword
};