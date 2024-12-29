const Config = require('../models/config');
const axios = require('axios');
const { validationResult } = require('express-validator');

class ConfigController {
    // Retrieve system configuration
    async getConfiguration(req, res) {
        try {
            // Basic system configuration
            const config = {
                features: {
                    interviews: {
                        enabled: true,
                        maxDuration: 3600
                    },
                    aiAnalysis: {
                        enabled: true,
                        providers: ['openai']
                    }
                },
                openai: {
                    model: await Config.getConfigValue('OPENAI_MODEL', 'openai') || 'gpt-4',
                    maxTokens: await Config.getConfigValue('OPENAI_MAX_TOKENS', 'openai') || 1000,
                    // Never send the actual API key
                    apiKeyConfigured: !!(await Config.getConfigValue('OPENAI_API_KEY', 'openai'))
                }
            };

            // Add more configuration based on user role
            if (req.user && req.user.role === 'admin') {
                config.debug = {
                    env: process.env.NODE_ENV,
                    timestamp: new Date().toISOString()
                };
            }

            res.json(config);
        } catch (error) {
            console.error('Configuration retrieval error:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve configuration', 
                details: error.message 
            });
        }
    }

    // Validate OpenAI API Key
    async validateOpenAIKey(req, res) {
        // Input validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Ensure only admin can validate keys
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Unauthorized', 
                message: 'Only administrators can validate API keys' 
            });
        }

        const { apiKey } = req.body;

        try {
            // Validate key by making a test API call
            await this.testOpenAIKey(apiKey);

            // If successful, store encrypted key
            await Config.setConfigValue(
                'OPENAI_API_KEY', 
                apiKey, 
                'openai', 
                req.user._id, 
                'OpenAI API Key for system integration'
            );

            res.json({ 
                success: true, 
                message: 'OpenAI API Key validated and stored successfully' 
            });
        } catch (error) {
            console.error('OpenAI Key Validation Error:', error);
            res.status(400).json({ 
                success: false, 
                error: 'Invalid API Key', 
                details: error.message 
            });
        }
    }

    // Test OpenAI API Key
    async testOpenAIKey(apiKey) {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions', 
                {
                    model: "gpt-3.5-turbo",
                    messages: [{ role: "user", content: "System key validation test" }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000 // 10-second timeout
                }
            );

            // Additional validation of response
            if (!response.data || !response.data.choices) {
                throw new Error('Invalid API response');
            }

            return true;
        } catch (error) {
            // Detailed error logging
            console.error('OpenAI Key Test Failed:', error.response?.data || error.message);
            
            // Throw a generic error to prevent info leakage
            throw new Error('API Key validation failed');
        }
    }

    // Retrieve specific configuration value (for internal use)
    async getConfigValue(key, type = 'system') {
        try {
            return await Config.getConfigValue(key, type);
        } catch (error) {
            console.error(`Error retrieving config value for ${key}:`, error);
            return null;
        }
    }
}

module.exports = new ConfigController();