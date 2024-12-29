// backend/src/controllers/user.controller.js
const User = require('../models/user.model');
const { ApiError } = require('../middleware/error.middleware');
const config = require('../config/env.config');

class UserController {
    // Get all users (admin only)
    async getAllUsers(req, res, next) {
        try {
            // Only admin can access all users
            if (req.user.role !== 'admin') {
                throw new ApiError('Unauthorized access', 403);
            }

            const users = await User.find()
                .select('-password')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: users.length,
                users
            });
        } catch (error) {
            next(error);
        }
    }

    // Get user profile
    async getUserProfile(req, res, next) {
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
                    role: user.role,
                    preferences: user.preferences,
                    metadata: user.metadata
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Update user profile
    async updateUserProfile(req, res, next) {
        try {
            const { firstName, lastName, preferences } = req.body;
            const user = await User.findById(req.user.id);

            if (!user) {
                throw new ApiError('User not found', 404);
            }

            // Update basic info
            if (firstName) user.firstName = firstName;
            if (lastName) user.lastName = lastName;
            if (preferences) {
                user.preferences = {
                    ...user.preferences,
                    ...preferences
                };
            }

            await user.save();

            res.json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    preferences: user.preferences,
                    metadata: user.metadata
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Change user role (admin only)
    async changeUserRole(req, res, next) {
        try {
            const { userId, role } = req.body;

            if (req.user.role !== 'admin') {
                throw new ApiError('Unauthorized access', 403);
            }

            const validRoles = ['admin', 'interviewer', 'recruiter'];
            if (!validRoles.includes(role)) {
                throw new ApiError('Invalid role specified', 400);
            }

            const user = await User.findByIdAndUpdate(
                userId,
                { role },
                { new: true }
            ).select('-password');

            if (!user) {
                throw new ApiError('User not found', 404);
            }

            res.json({
                success: true,
                message: `User role updated to ${role}`,
                user
            });
        } catch (error) {
            next(error);
        }
    }

    // Deactivate user (admin only)
    async deactivateUser(req, res, next) {
        try {
            const { userId } = req.params;

            if (req.user.role !== 'admin') {
                throw new ApiError('Unauthorized access', 403);
            }

            if (userId === req.user.id) {
                throw new ApiError('Cannot deactivate your own account', 400);
            }

            const user = await User.findByIdAndUpdate(
                userId,
                { 
                    isActive: false,
                    lastLogin: new Date()
                },
                { new: true }
            ).select('-password');

            if (!user) {
                throw new ApiError('User not found', 404);
            }

            res.json({
                success: true,
                message: 'User account deactivated successfully',
                user
            });
        } catch (error) {
            next(error);
        }
    }

    // Get user metadata and stats
    async getUserStats(req, res, next) {
        try {
            const userId = req.params.userId || req.user.id;

            // Check authorization
            if (req.user.role !== 'admin' && req.user.id !== userId) {
                throw new ApiError('Unauthorized access', 403);
            }

            const user = await User.findById(userId).select('-password');
            if (!user) {
                throw new ApiError('User not found', 404);
            }

            // Calculate additional stats
            const stats = {
                totalInterviews: user.metadata.createdInterviews || 0,
                completedInterviews: user.metadata.completedInterviews || 0,
                completionRate: user.metadata.createdInterviews ? 
                    (user.metadata.completedInterviews / user.metadata.createdInterviews * 100).toFixed(2) : 0,
                lastActive: user.lastLogin || user.metadata.lastInterviewDate,
                accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)) // in days
            };

            res.json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role
                },
                stats,
                metadata: user.metadata,
                preferences: user.preferences
            });
        } catch (error) {
            next(error);
        }
    }

    // Update user preferences
    async updatePreferences(req, res, next) {
        try {
            const { notifications, timezone, language } = req.body.preferences || {};

            const user = await User.findById(req.user.id);
            if (!user) {
                throw new ApiError('User not found', 404);
            }

            // Update preferences
            if (notifications !== undefined) {
                user.preferences.notifications = {
                    ...user.preferences.notifications,
                    ...notifications
                };
            }

            if (timezone) {
                // Validate timezone
                if (!Intl.supportedValuesOf('timeZone').includes(timezone)) {
                    throw new ApiError('Invalid timezone', 400);
                }
                user.preferences.timezone = timezone;
            }

            if (language) {
                // Validate language code
                if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
                    throw new ApiError('Invalid language code', 400);
                }
                user.preferences.language = language;
            }

            await user.save();

            res.json({
                success: true,
                preferences: user.preferences
            });
        } catch (error) {
            next(error);
        }
    }

    // Update user metadata
    async updateMetadata(req, res, next) {
        try {
            const user = await User.findById(req.user.id);
            if (!user) {
                throw new ApiError('User not found', 404);
            }

            const { interviewId, status } = req.body;

            // Update interview-related metadata
            if (interviewId && status) {
                await user.updateInterviewMetadata(status);
            }

            res.json({
                success: true,
                metadata: user.metadata
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();