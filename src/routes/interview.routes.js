// backend/src/routes/interview.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const interviewController = require('../controllers/interview.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

// Validation middleware for interview creation
const createInterviewValidation = [
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
            if (interviewDate <= new Date()) {
                throw new Error('Interview date must be in the future');
            }
            return true;
        }),
    
    body('interviewType')
        .notEmpty().withMessage('Interview type is required')
        .isIn(['technical', 'hr', 'final']).withMessage('Invalid interview type'),
    
    body('status')
        .optional()
        .isIn(['scheduled', 'ongoing', 'completed', 'cancelled'])
        .withMessage('Invalid interview status'),
    
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

// Validation middleware for update status
const updateStatusValidation = [
    param('id').isMongoId().withMessage('Invalid interview ID'),
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['scheduled', 'ongoing', 'completed', 'cancelled'])
        .withMessage('Invalid interview status')
];

// Routes with authentication and validation middleware
router.get('/', 
    authMiddleware.authenticateUser, 
    interviewController.getAllInterviews
);

router.post('/', 
    authMiddleware.authenticateUser,
    createInterviewValidation,
    validationMiddleware.validateRequest,
    interviewController.createInterview
);

router.get('/:id', 
    authMiddleware.authenticateUser,
    param('id').isMongoId().withMessage('Invalid interview ID'),
    validationMiddleware.validateRequest,
    interviewController.getInterviewById
);

router.patch('/:id/status', 
    authMiddleware.authenticateUser,
    updateStatusValidation,
    validationMiddleware.validateRequest,
    interviewController.updateInterviewStatus
);

router.delete('/:id', 
    authMiddleware.authenticateUser,
    param('id').isMongoId().withMessage('Invalid interview ID'),
    validationMiddleware.validateRequest,
    interviewController.deleteInterview
);

// Analytics route (admin only)
router.get('/analytics', 
    authMiddleware.authenticateUser,
    authMiddleware.checkRoles(['admin']),
    interviewController.getInterviewAnalytics
);

module.exports = router;