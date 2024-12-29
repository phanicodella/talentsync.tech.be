const express = require('express');
const { body } = require('express-validator');
const configController = require('../controllers/configController');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Get system configuration
router.get('/config', 
    authMiddleware.authenticateUser, 
    configController.getConfiguration.bind(configController)
);

// Validate and store OpenAI API Key (admin only)
router.post('/config/openai-key', 
    authMiddleware.authenticateUser,
    authMiddleware.requireAdmin,
    [
        // Validation middleware
        body('apiKey')
            .trim()
            .notEmpty().withMessage('API Key is required')
            .isLength({ min: 40, max: 100 }).withMessage('Invalid API Key format')
    ],
    configController.validateOpenAIKey.bind(configController)
);

module.exports = router;