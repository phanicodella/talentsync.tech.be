// backend/src/services/realtimeAnalysis.service.js
const openaiService = require('./openai.service');
const logger = require('../utils/logging.utils');

class RealtimeAnalysisService {
    constructor() {
        this.sessions = new Map();
        this.analysisBuffer = new Map();
        this.BUFFER_THRESHOLD = 200; // words
        this.ANALYSIS_INTERVAL = 10000; // 10 seconds
    }

    initializeSession(sessionId, interviewType) {
        this.sessions.set(sessionId, {
            type: interviewType,
            transcript: '',
            responses: [],
            analysis: {
                currentScore: 0,
                confidence: 0,
                flags: [],
                recommendations: []
            },
            lastAnalysis: Date.now(),
            bufferSize: 0
        });
    }

    async handleTranscriptUpdate(sessionId, newText, isResponse = false) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }

            // Update transcript and buffer
            session.transcript += ' ' + newText;
            session.bufferSize += newText.split(' ').length;

            if (isResponse) {
                session.responses.push(newText);
            }

            // Check if we should trigger analysis
            const shouldAnalyze = 
                session.bufferSize >= this.BUFFER_THRESHOLD || 
                (Date.now() - session.lastAnalysis >= this.ANALYSIS_INTERVAL);

            if (shouldAnalyze) {
                return await this.performAnalysis(sessionId);
            }

            return null;
        } catch (error) {
            logger.error('Transcript update error:', error);
            throw error;
        }
    }

    async performAnalysis(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        try {
            // Analyze latest content
            const analysis = await openaiService.analyzeInterview(session.transcript, {
                type: session.type,
                bypass_cache: true // We want real-time analysis
            });

            // Analyze latest response if available
            let responseAnalysis = null;
            if (session.responses.length > 0) {
                const latestResponse = session.responses[session.responses.length - 1];
                responseAnalysis = await openaiService.analyzeResponse(
                    latestResponse,
                    session.type
                );
            }

            // Update session state
            session.analysis = {
                ...analysis,
                responseAnalysis,
                timestamp: new Date().toISOString()
            };
            session.lastAnalysis = Date.now();
            session.bufferSize = 0;

            // Generate follow-up questions if needed
            if (responseAnalysis && responseAnalysis.score < 0.7) {
                const followUps = await openaiService.generateQuestions(
                    session.transcript,
                    session.type,
                    2
                );
                session.analysis.followUpQuestions = followUps;
            }

            return {
                type: 'analysis_update',
                data: {
                    analysis: session.analysis,
                    metrics: this.calculateMetrics(session)
                }
            };
        } catch (error) {
            logger.error('Analysis error:', error);
            return {
                type: 'analysis_error',
                error: error.message
            };
        }
    }

    calculateMetrics(session) {
        try {
            const words = session.transcript.split(' ').length;
            const responses = session.responses.length;
            const avgResponseLength = responses > 0 
                ? session.responses.reduce((sum, r) => sum + r.split(' ').length, 0) / responses 
                : 0;

            return {
                totalWords: words,
                responses: responses,
                averageResponseLength: avgResponseLength,
                duration: Date.now() - session.startTime,
                flags: session.analysis.flags.length
            };
        } catch (error) {
            logger.error('Metrics calculation error:', error);
            return {};
        }
    }

    async getFinalAnalysis(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        try {
            // Perform final comprehensive analysis
            const finalAnalysis = await openaiService.analyzeInterview(session.transcript, {
                type: session.type,
                comprehensive: true
            });

            // Generate feedback
            const feedback = await openaiService.generateFeedback(finalAnalysis, session.type);

            return {
                analysis: finalAnalysis,
                feedback,
                metrics: this.calculateMetrics(session),
                transcript: session.transcript,
                responses: session.responses,
                duration: Date.now() - session.startTime
            };
        } catch (error) {
            logger.error('Final analysis error:', error);
            throw error;
        }
    }

    endSession(sessionId) {
        const hadSession = this.sessions.delete(sessionId);
        return hadSession;
    }

    getSessionState(sessionId) {
        return this.sessions.get(sessionId);
    }

    getSummaryMetrics(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return this.calculateMetrics(session);
    }
}

module.exports = new RealtimeAnalysisService();
