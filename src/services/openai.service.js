// backend/src/services/openai.service.js
const { Configuration, OpenAIApi } = require('openai');
const NodeCache = require('node-cache');
const config = require('../config/env.config');
const { ApiError } = require('../middleware/error.middleware');

class OpenAIService {
    constructor() {
        this.configuration = new Configuration({
            apiKey: config.openaiKey
        });
        this.openai = new OpenAIApi(this.configuration);
        
        // Cache for storing analysis results
        this.cache = new NodeCache({ 
            stdTTL: 3600, // 1 hour default TTL
            checkperiod: 120 // Check for expired entries every 2 minutes
        });

        // Question bank for different interview types
        this.questionBank = {
            technical: this.loadTechnicalQuestions(),
            hr: this.loadHRQuestions(),
            behavioral: this.loadBehavioralQuestions()
        };
    }

    async analyzeInterview(transcript, options = {}) {
        try {
            const cacheKey = `analysis_${Buffer.from(transcript).toString('base64').slice(0, 32)}`;
            const cachedResult = this.cache.get(cacheKey);
            
            if (cachedResult && !options.bypass_cache) {
                return cachedResult;
            }

            const response = await this.openai.createChatCompletion({
                model: "gpt-4",
                messages: [{
                    role: 'system',
                    content: `You are an expert interview assessor. Analyze this interview transcript comprehensively.
                    Focus on:
                    - Technical competency
                    - Communication skills
                    - Problem-solving approach
                    - Cultural fit
                    - Red flags or concerns
                    
                    Provide the analysis in the following JSON structure:
                    {
                        "competency_scores": {
                            "technical": <0-1>,
                            "communication": <0-1>,
                            "problem_solving": <0-1>,
                            "cultural_fit": <0-1>
                        },
                        "key_observations": [
                            {
                                "type": "strength|weakness|neutral",
                                "observation": "detailed observation",
                                "impact": "high|medium|low",
                                "context": "relevant quote from transcript"
                            }
                        ],
                        "red_flags": [
                            {
                                "severity": "high|medium|low",
                                "description": "detailed description",
                                "context": "relevant quote"
                            }
                        ],
                        "recommendations": {
                            "next_steps": ["specific action items"],
                            "areas_to_probe": ["specific areas"],
                            "follow_up_questions": ["specific questions"]
                        },
                        "sentiment_analysis": {
                            "confidence": <0-1>,
                            "enthusiasm": <0-1>,
                            "authenticity": <0-1>
                        }
                    }`
                }, {
                    role: 'user',
                    content: transcript
                }],
                temperature: 0.4,
                max_tokens: 2000,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            });

            const analysis = JSON.parse(response.data.choices[0].message.content);
            
            // Cache the result
            this.cache.set(cacheKey, analysis);
            
            return analysis;
        } catch (error) {
            console.error('OpenAI Analysis Error:', error);
            throw new ApiError('Failed to analyze interview', 500);
        }
    }

    async generateQuestions(context, type = 'technical', count = 3) {
        try {
            const response = await this.openai.createChatCompletion({
                model: "gpt-4",
                messages: [{
                    role: 'system',
                    content: `Generate ${count} relevant follow-up questions based on the interview context.
                    Questions should be for a ${type} interview and should:
                    - Probe deeper into areas mentioned
                    - Address any gaps or inconsistencies
                    - Be specific and contextual
                    - Encourage detailed responses
                    
                    Return as a JSON array of objects with the following structure:
                    {
                        "question": "the actual question",
                        "intent": "what this question aims to uncover",
                        "follow_ups": ["potential follow-up questions"],
                        "key_points": ["what to listen for in the answer"]
                    }`
                }, {
                    role: 'user',
                    content: context
                }],
                temperature: 0.7,
                max_tokens: 1000
            });

            return JSON.parse(response.data.choices[0].message.content);
        } catch (error) {
            console.error('Question Generation Error:', error);
            return this.getFallbackQuestions(type, count);
        }
    }

    async analyzeResponse(question, response, type = 'technical') {
        try {
            const analysisPrompt = this.getAnalysisPrompt(type);
            
            const result = await this.openai.createChatCompletion({
                model: "gpt-4",
                messages: [{
                    role: 'system',
                    content: analysisPrompt
                }, {
                    role: 'user',
                    content: `Question: ${question}\n\nResponse: ${response}`
                }],
                temperature: 0.3,
                max_tokens: 500
            });

            return JSON.parse(result.data.choices[0].message.content);
        } catch (error) {
            console.error('Response Analysis Error:', error);
            throw new ApiError('Failed to analyze response', 500);
        }
    }

    async generateFeedback(analysis, type = 'technical') {
        try {
            const response = await this.openai.createChatCompletion({
                model: "gpt-4",
                messages: [{
                    role: 'system',
                    content: `Generate comprehensive interview feedback based on the analysis.
                    Include:
                    - Strengths and areas for improvement
                    - Specific examples from the interview
                    - Actionable recommendations
                    - Overall assessment
                    
                    Format as a structured report suitable for both the interviewer and hiring manager.`
                }, {
                    role: 'user',
                    content: JSON.stringify(analysis)
                }],
                temperature: 0.4,
                max_tokens: 1000
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Feedback Generation Error:', error);
            throw new ApiError('Failed to generate feedback', 500);
        }
    }

    // Helper methods
    loadTechnicalQuestions() {
        return require('../data/technical-questions.json');
    }

    loadHRQuestions() {
        return require('../data/hr-questions.json');
    }

    loadBehavioralQuestions() {
        return require('../data/behavioral-questions.json');
    }

    getFallbackQuestions(type, count) {
        const questions = this.questionBank[type] || this.questionBank.behavioral;
        return questions.slice(0, count).map(q => ({
            question: q.question,
            intent: q.intent || 'Assess candidate\'s experience and skills',
            follow_ups: q.follow_ups || [],
            key_points: q.key_points || []
        }));
    }

    getAnalysisPrompt(type) {
        const prompts = {
            technical: `Analyze this technical response for:
                - Technical accuracy
                - Problem-solving approach
                - Code quality (if applicable)
                - Understanding of concepts`,
            hr: `Analyze this response for:
                - Communication clarity
                - Cultural fit
                - Professional attitude
                - Career alignment`,
            behavioral: `Analyze this response for:
                - Situation handling
                - Decision-making process
                - Leadership qualities
                - Team collaboration`
        };
        return prompts[type] || prompts.behavioral;
    }

    // Cleanup
    clearCache() {
        this.cache.flushAll();
    }

    // Usage tracking
    async trackUsage(sessionId, type) {
        // Implement usage tracking if needed
    }
}

module.exports = new OpenAIService();
