// backend/src/routes/auth.routes.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { ApiError } = require('../middleware/error.middleware');
const {
    register,
    login,
    getCurrentUser,
    updateProfile,
    requestPasswordReset,
    resetPassword
} = require('../controllers/auth.controller');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new ApiError('Validation failed', 400, errors.array());
    }
    next();
};

// Registration validation rules
const registerValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please enter a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one number, one uppercase letter, one lowercase letter, and one special character'),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ max: 50 })
        .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ max: 50 })
        .withMessage('Last name cannot exceed 50 characters'),
    body('role')
        .optional()
        .isIn(['admin', 'interviewer', 'recruiter'])
        .withMessage('Invalid role specified')
];

// Login validation rules
const loginValidation = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please enter a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Profile update validation rules
const updateProfileValidation = [
    body('firstName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('First name cannot be empty')
        .isLength({ max: 50 })
        .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Last name cannot be empty')
        .isLength({ max: 50 })
        .withMessage('Last name cannot exceed 50 characters'),
    body('currentPassword')
        .optional()
        .notEmpty()
        .withMessage('Current password is required when updating password'),
    body('newPassword')
        .optional()
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters')
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
        .withMessage('New password must contain at least one number, one uppercase letter, one lowercase letter, and one special character')
];

// Password reset validation rules
const resetPasswordValidation = [
    body('token')
        .notEmpty()
        .withMessage('Reset token is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one number, one uppercase letter, one lowercase letter, and one special character')
];

// Rate limiting for auth routes
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth routes
    message: 'Too many login attempts, please try again later'
});

// Routes
router.post('/register', registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.get('/me', verifyToken, getCurrentUser);
router.put('/profile', verifyToken, updateProfileValidation, validate, updateProfile);
router.post('/password/reset-request', 
    body('email').isEmail().withMessage('Please enter a valid email'),
    validate,
    requestPasswordReset
);
router.post('/password/reset', resetPasswordValidation, validate, resetPassword);

// Admin routes
router.get('/users', 
    verifyToken, 
    checkRole(['admin']), 
    async (req, res, next) => {
        try {
            const User = require('../models/user.model');
            const users = await User.find()
                .select('-password')
                .sort({ createdAt: -1 });
            res.json({ success: true, users });
        } catch (error) {
            next(error);
        }
    }
);

router.put('/users/:userId/role',
    verifyToken,
    checkRole(['admin']),
    [
        body('role')
            .isIn(['admin', 'interviewer', 'recruiter'])
            .withMessage('Invalid role specified')
    ],
    validate,
    async (req, res, next) => {
        try {
            const User = require('../models/user.model');
            const user = await User.findByIdAndUpdate(
                req.params.userId,
                { role: req.body.role },
                { new: true }
            ).select('-password');

            if (!user) {
                throw new ApiError('User not found', 404);
            }

            res.json({ success: true, user });
        } catch (error) {
            next(error);
        }
    }
);

// Health check route
router.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

module.exports = router;