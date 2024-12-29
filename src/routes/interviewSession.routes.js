// backend/src/routes/interviewSession.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const interviewSessionController = require('../controllers/interviewSession.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const fileUpload = require('../middleware/fileUpload.middleware');

// Verify interview and get access token
router.post('/verify/:id',
    [
        param('id').isMongoId().withMessage('Invalid interview ID'),
        body('candidateName').trim().notEmpty().withMessage('Candidate name is required')
    ],
    validateRequest,
    interviewSessionController.verifyInterview
);

// Start interview session
router.post('/:id/start',
    authMiddleware.authenticateUser,
    [
        param('id').isMongoId().withMessage('Invalid interview ID')
    ],
    validateRequest,
    interviewSessionController.startSession
);

// Update session status
router.patch('/:id/status',
    authMiddleware.authenticateUser,
    [
        param('id').isMongoId().withMessage('Invalid interview ID'),
        body('status')
            .isIn(['ongoing', 'completed', 'cancelled'])
            .withMessage('Invalid status'),
        body('participantData').optional().isObject().withMessage('Invalid participant data')
    ],
    validateRequest,
    interviewSessionController.updateSession
);

// Upload session recording
router.post('/:id/recording',
    authMiddleware.authenticateUser,
    [
        param('id').isMongoId().withMessage('Invalid interview ID')
    ],
    validateRequest,
    fileUpload.single('recording', {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: ['video/webm']
    }),
    interviewSessionController.uploadRecording
);

// Submit session analysis
router.post('/:id/analysis',
    authMiddleware.authenticateUser,
    [
        param('id').isMongoId().withMessage('Invalid interview ID'),
        body('analysis').isObject().withMessage('Analysis data is required'),
        body('transcript').optional().isString().withMessage('Invalid transcript')
    ],
    validateRequest,
    interviewSessionController.submitAnalysis
);

// Get session analysis
router.get('/:id/analysis',
    authMiddleware.authenticateUser,
    [
        param('id').isMongoId().withMessage('Invalid interview ID')
    ],
    validateRequest,
    interviewSessionController.getAnalysis
);

module.exports = router;
