// backend/src/middleware/validation.middleware.js
const { validationResult } = require('express-validator');
const { ApiError } = require('./error.middleware');

class ValidationMiddleware {
    // Validate request and throw errors if validation fails
    static validateRequest(req, res, next) {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            // Transform errors into more readable format
            const formattedErrors = errors.array().map(error => ({
                field: error.path,
                message: error.msg
            }));

            throw new ApiError('Validation failed', 400, formattedErrors);
        }

        next();
    }

    // Validate interview creation
    static validateInterviewCreation() {
        return [
            body('candidateName')
                .trim()
                .notEmpty().withMessage('Candidate name is required')
                .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
            
            body('candidateEmail')
                .trim()
                .notEmpty().withMessage('Email is required')
                .isEmail().withMessage('Invalid email format'),
            
            body('candidatePhone')
                .optional()
                .isMobilePhone().withMessage('Invalid phone number'),
            
            body('interviewDate')
                .notEmpty().withMessage('Interview date is required')
                .isISO8601().withMessage('Invalid date format')
                .custom(value => {
                    const interviewDate = new Date(value);
                    if (interviewDate < new Date()) {
                        throw new Error('Interview date must be in the future');
                    }
                    return true;
                }),
            
            body('interviewType')
                .notEmpty().withMessage('Interview type is required')
                .isIn(['technical', 'hr', 'final']).withMessage('Invalid interview type'),
            
            body('status')
                .optional()
                .isIn(['scheduled', 'completed', 'cancelled', 'rescheduled'])
                .withMessage('Invalid interview status'),
            
            body('notes')
                .optional()
                .trim()
                .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
            
            this.validateRequest
        ];
    }

    // Validate user registration
    static validateUserRegistration() {
        return [
            body('email')
                .trim()
                .notEmpty().withMessage('Email is required')
                .isEmail().withMessage('Invalid email format')
                .normalizeEmail(),
            
            body('password')
                .notEmpty().withMessage('Password is required')
                .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
                .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
                .withMessage('Password must include uppercase, lowercase, number, and special character'),
            
            body('firstName')
                .trim()
                .notEmpty().withMessage('First name is required')
                .isLength({ max: 50 }).withMessage('First name cannot exceed 50 characters'),
            
            body('lastName')
                .trim()
                .notEmpty().withMessage('Last name is required')
                .isLength({ max: 50 }).withMessage('Last name cannot exceed 50 characters'),
            
            body('role')
                .optional()
                .isIn(['admin', 'interviewer', 'recruiter'])
                .withMessage('Invalid role'),
            
            this.validateRequest
        ];
    }
}

module.exports = ValidationMiddleware;