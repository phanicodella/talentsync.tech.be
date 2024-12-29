// backend/src/services/websocket.service.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config/env.config');
const Interview = require('../models/interview.model');
const openaiService = require('./openai.service');
const realtimeAnalysisService = require('./realtimeAnalysisService'); // Assuming this service is defined

class WebSocketService {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.sessions = new Map();
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', async (ws, req) => {
            try {
                const params = this.parseConnectionParams(req.url);
                const user = await this.authenticateUser(params.token);

                // Set connection metadata
                ws.userData = user;
                ws.interviewId = params.interviewId;
                ws.isAlive = true;

                // Setup ping-pong
                ws.on('pong', () => { ws.isAlive = true; });

                // Add to session
                await this.addToSession(ws, params.interviewId);

                // Setup message handlers
                this.setupMessageHandlers(ws);

            } catch (error) {
                console.error('WebSocket connection error:', error);
                ws.close(4001, error.message);
            }
        });

        // Setup heartbeat
        setInterval(() => {
            this.wss.clients.forEach(ws => {
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    parseConnectionParams(url) {
        const params = new URLSearchParams(url.slice(1));
        const token = params.get('token');
        const interviewId = params.get('interviewId');

        if (!token || !interviewId) {
            throw new Error('Missing required connection parameters');
        }

        return { token, interviewId };
    }

    async authenticateUser(token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret);

            // If it's a candidate token
            if (decoded.type === 'candidate') {
                const interview = await Interview.findById(decoded.interviewId);
                if (!interview) throw new Error('Interview not found');

                return {
                    id: `candidate-${interview._id}`,
                    name: interview.candidateName,
                    role: 'candidate',
                    interviewId: interview._id
                };
            }

            // For regular users
            return {
                id: decoded.id,
                name: `${decoded.firstName} ${decoded.lastName}`,
                role: decoded.role
            };
        } catch (error) {
            throw new Error('Authentication failed');
        }
    }

    async addToSession(ws, interviewId) {
        if (!this.sessions.has(interviewId)) {
            this.sessions.set(interviewId, new Set());
        }
        
        const session = this.sessions.get(interviewId);
        session.add(ws);

        // Notify others in session
        this.broadcastToSession(interviewId, {
            type: 'participant_joined',
            data: {
                id: ws.userData.id,
                name: ws.userData.name,
                role: ws.userData.role,
                timestamp: new Date()
            }
        }, ws);

        // Send current participants to new joiner
        const participants = Array.from(session).map(client => ({
            id: client.userData.id,
            name: client.userData.name,
            role: client.userData.role
        }));

        ws.send(JSON.stringify({
            type: 'session_info',
            data: { participants }
        }));
    }

    setupMessageHandlers(ws) {
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data);
                
                switch (message.type) {
                    case 'chat':
                        await this.handleChat(ws, message);
                        break;
                    case 'transcript_update':
                        await this.handleTranscriptUpdate(ws, message);
                        break;
                    case 'analysis_update':
                        await this.handleAnalysisUpdate(ws, message);
                        break;
                    case 'interview_control':
                        await this.handleInterviewControl(ws, message);
                        break;
                    case 'status_update':
                        await this.handleStatusUpdate(ws, message);
                        break;
                    default:
                        console.warn('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('Message handling error:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    error: error.message
                }));
            }
        });

        ws.on('close', () => {
            this.handleDisconnect(ws);
        });
    }

    async handleChat(ws, message) {
        const chatMessage = {
            type: 'chat',
            data: {
                sender: {
                    id: ws.userData.id,
                    name: ws.userData.name,
                    role: ws.userData.role
                },
                message: message.data,
                timestamp: new Date()
            }
        };

        this.broadcastToSession(ws.interviewId, chatMessage);
    }

    async handleTranscriptUpdate(ws, message) {
        if (!['interviewer', 'candidate'].includes(ws.userData.role)) {
            throw new Error('Unauthorized: Invalid role for transcript update');
        }

        const transcript = message.data.transcript;
        const isResponse = message.data.isResponse || false;
        
        if (transcript) {
            // Get analysis from realtime service
            const analysis = await realtimeAnalysisService.handleTranscriptUpdate(
                ws.interviewId,
                transcript,
                isResponse
            );

            // Update interview transcript
            await Interview.findByIdAndUpdate(ws.interviewId, {
                'metadata.transcriptUrl': transcript,
                'metadata.aiAnalysis': analysis?.data?.analysis || null
            });

            // Broadcast transcript update
            this.broadcastToSession(ws.interviewId, {
                type: 'transcript_updated',
                data: { 
                    transcript,
                    source: ws.userData.role,
                    timestamp: new Date()
                }
            });

            // If we have analysis, broadcast it
            if (analysis) {
                this.broadcastToSession(ws.interviewId, {
                    type: 'analysis_updated',
                    data: analysis.data
                });
            }
        }
    }

    async handleAnalysisUpdate(ws, message) {
        if (ws.userData.role !== 'interviewer') {
            throw new Error('Unauthorized: Only interviewers can update analysis');
        }

        const analysis = message.data.analysis;
        if (analysis) {
            // Update interview analysis
            await Interview.findByIdAndUpdate(ws.interviewId, {
                'metadata.aiAnalysis': analysis
            });

            // Broadcast update
            this.broadcastToSession(ws.interviewId, {
                type: 'analysis_updated',
                data: { analysis }
            });
        }
    }

    async handleInterviewControl(ws, message) {
        if (ws.userData.role !== 'interviewer') {
            throw new Error('Unauthorized: Only interviewers can control interview');
        }

        const { action } = message.data;
        const interview = await Interview.findById(ws.interviewId);

        switch (action) {
            case 'start':
                interview.status = 'ongoing';
                // Initialize realtime analysis
                realtimeAnalysisService.initializeSession(ws.interviewId, interview.interviewType);
                break;
            
            case 'end':
                interview.status = 'completed';
                // Get final analysis
                const finalAnalysis = await realtimeAnalysisService.getFinalAnalysis(ws.interviewId);
                // Update interview with final analysis
                interview.metadata.aiAnalysis = finalAnalysis.analysis;
                interview.metadata.feedback = finalAnalysis.feedback;
                // Cleanup analysis session
                realtimeAnalysisService.endSession(ws.interviewId);
                break;
            
            case 'pause':
                // Store current state
                interview.metadata.aiAnalysis = realtimeAnalysisService
                    .getSessionState(ws.interviewId)?.analysis || null;
                break;
        }

        await interview.save();

        // Broadcast control message
        this.broadcastToSession(ws.interviewId, {
            type: 'interview_control',
            data: { 
                action, 
                status: interview.status,
                analysis: action === 'end' ? interview.metadata.aiAnalysis : null,
                feedback: action === 'end' ? interview.metadata.feedback : null
            }
        });
    }

    async handleStatusUpdate(ws, message) {
        const { status } = message.data;
        this.broadcastToSession(ws.interviewId, {
            type: 'status_update',
            data: {
                userId: ws.userData.id,
                status,
                timestamp: new Date()
            }
        }, ws);
    }

    handleDisconnect(ws) {
        const session = this.sessions.get(ws.interviewId);
        if (session) {
            session.delete(ws);
            
            // Notify others about disconnection
            this.broadcastToSession(ws.interviewId, {
                type: 'participant_left',
                data: {
                    id: ws.userData.id,
                    name: ws.userData.name,
                    timestamp: new Date()
                }
            });

            // Clean up empty session
            if (session.size === 0) {
                this.sessions.delete(ws.interviewId);
            }
        }
    }

    broadcastToSession(interviewId, message, excludeWs = null) {
        const session = this.sessions.get(interviewId);
        if (!session) return;

        const messageStr = JSON.stringify(message);
        session.forEach(client => {
            if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }

    shutdown() {
        this.wss.clients.forEach(client => {
            client.close(1012, 'Server is shutting down');
        });
        this.wss.close();
    }
}

module.exports = WebSocketService;
