// backend/src/controllers/interviewSession.controller.js
const jwt = require('jsonwebtoken');
const Interview = require('../models/interview.model');
const User = require('../models/user.model');
const config = require('../config/env.config');
const { ApiError } = require('../middleware/error.middleware');
const openaiService = require('../services/openai.service');
const s3Service = require('../services/s3.service');

class InterviewSessionController {
    // Verify and get interview details
    async verifyInterview(req, res, next) {
        try {
            const { id } = req.params;
            const { candidateName } = req.body;

            if (!candidateName) {
                throw new ApiError('Candidate name is required', 400);
            }

            const interview = await Interview.findById(id);
            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Check if interview can be started
            if (interview.status !== 'scheduled') {
                throw new ApiError('Interview cannot be started', 400);
            }

            // Generate temporary access token for candidate
            const token = jwt.sign({
                interviewId: interview._id,
                candidateName,
                role: 'candidate'
            }, config.jwtSecret, { expiresIn: '2h' });

            // Return interview details and token
            res.json({
                success: true,
                token,
                interview: {
                    id: interview._id,
                    type: interview.interviewType,
                    scheduledDate: interview.interviewDate,
                    candidateName: interview.candidateName,
                    status: interview.status
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Start interview session
    async startSession(req, res, next) {
        try {
            const { id } = req.params;
            const interview = await Interview.findById(id);

            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Verify permissions
            if (!this.canManageInterview(req.user, interview)) {
                throw new ApiError('Unauthorized access', 403);
            }

            // Update interview status
            interview.status = 'ongoing';
            interview.sessionData = {
                startTime: new Date(),
                participants: [{
                    id: req.user._id,
                    name: `${req.user.firstName} ${req.user.lastName}`,
                    role: req.user.role,
                    joinedAt: new Date()
                }]
            };

            await interview.save();

            res.json({
                success: true,
                message: 'Interview session started',
                sessionData: interview.sessionData
            });
        } catch (error) {
            next(error);
        }
    }

    // Update session status
    async updateSession(req, res, next) {
        try {
            const { id } = req.params;
            const { status, participantData } = req.body;

            const interview = await Interview.findById(id);
            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Verify permissions
            if (!this.canManageInterview(req.user, interview)) {
                throw new ApiError('Unauthorized access', 403);
            }

            // Update session data
            if (participantData) {
                const participant = interview.sessionData.participants.find(
                    p => p.id.toString() === participantData.id
                );

                if (participant) {
                    Object.assign(participant, participantData);
                } else {
                    interview.sessionData.participants.push(participantData);
                }
            }

            // Update status if provided
            if (status) {
                interview.status = status;
                if (status === 'completed') {
                    interview.sessionData.endTime = new Date();
                }
            }

            await interview.save();

            res.json({
                success: true,
                message: 'Session updated successfully',
                sessionData: interview.sessionData
            });
        } catch (error) {
            next(error);
        }
    }

    // Upload session recording
    async uploadRecording(req, res, next) {
        try {
            const { id } = req.params;
            const interview = await Interview.findById(id);

            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Verify permissions
            if (!this.canManageInterview(req.user, interview)) {
                throw new ApiError('Unauthorized access', 403);
            }

            if (!req.files || !req.files.recording) {
                throw new ApiError('Recording file is required', 400);
            }

            // Upload recording to storage
            const recording = req.files.recording;
            const key = `recordings/${interview._id}/${Date.now()}.webm`;
            const uploadResult = await s3Service.uploadFile(recording, key);

            // Update interview with recording URL
            interview.recordingUrl = uploadResult.Location;
            await interview.save();

            res.json({
                success: true,
                message: 'Recording uploaded successfully',
                recordingUrl: interview.recordingUrl
            });
        } catch (error) {
            next(error);
        }
    }

    // Submit interview analysis
    async submitAnalysis(req, res, next) {
        try {
            const { id } = req.params;
            const { transcript, analysis } = req.body;

            const interview = await Interview.findById(id);
            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Verify permissions
            if (!this.canManageInterview(req.user, interview)) {
                throw new ApiError('Unauthorized access', 403);
            }

            // Generate AI analysis if transcript provided
            if (transcript) {
                try {
                    const aiAnalysis = await openaiService.analyzeInterview(transcript);
                    interview.analysis = {
                        ...analysis,
                        ai: aiAnalysis
                    };
                } catch (error) {
                    console.error('AI analysis failed:', error);
                    interview.analysis = {
                        ...analysis,
                        ai: { error: 'AI analysis failed' }
                    };
                }
            } else {
                interview.analysis = analysis;
            }

            // Update interview status to completed
            interview.status = 'completed';
            interview.sessionData.endTime = new Date();

            await interview.save();

            res.json({
                success: true,
                message: 'Analysis submitted successfully',
                analysis: interview.analysis
            });
        } catch (error) {
            next(error);
        }
    }

    // Get session analysis
    async getAnalysis(req, res, next) {
        try {
            const { id } = req.params;
            const interview = await Interview.findById(id)
                .select('analysis sessionData status');

            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Verify permissions
            if (!this.canViewInterview(req.user, interview)) {
                throw new ApiError('Unauthorized access', 403);
            }

            res.json({
                success: true,
                analysis: interview.analysis,
                sessionData: interview.sessionData,
                status: interview.status
            });
        } catch (error) {
            next(error);
        }
    }

    // Permission helpers
    canManageInterview(user, interview) {
        return user.role === 'admin' || 
            interview.createdBy.toString() === user._id.toString();
    }

    canViewInterview(user, interview) {
        return user.role === 'admin' || 
            interview.createdBy.toString() === user._id.toString() ||
            interview.sessionData.participants.some(p => p.id.toString() === user._id.toString());
    }
}

module.exports = new InterviewSessionController();
