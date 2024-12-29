// backend/src/services/interview.service.js
const Interview = require('../models/interview.model');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/error.middleware');

class InterviewService {
    // Create a new interview
    async createInterview(interviewData, userId) {
        try {
            // Create interview
            const interview = new Interview({
                ...interviewData,
                createdBy: userId
            });

            // Save interview
            const savedInterview = await interview.save();

            // Update user's interview metadata
            const user = await User.findById(userId);
            if (user) {
                await user.updateInterviewMetadata(savedInterview.status);
            }

            return savedInterview;
        } catch (error) {
            throw new ApiError(`Failed to create interview: ${error.message}`, 400);
        }
    }

    // Get interviews with advanced filtering
    async getInterviews(filters = {}, options = {}) {
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'interviewDate', 
            sortOrder = 'desc' 
        } = options;

        try {
            const skipIndex = (page - 1) * limit;

            const query = Interview.find(filters)
                .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
                .skip(skipIndex)
                .limit(limit);

            const totalCount = await Interview.countDocuments(filters);
            const interviews = await query;

            return {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                interviews
            };
        } catch (error) {
            throw new ApiError(`Failed to retrieve interviews: ${error.message}`, 500);
        }
    }

    // Update interview status with validation
    async updateInterviewStatus(interviewId, status, userId) {
        try {
            const interview = await Interview.findById(interviewId);

            if (!interview) {
                throw new ApiError('Interview not found', 404);
            }

            // Validate status transition
            const validStatusTransitions = {
                'scheduled': ['ongoing', 'cancelled'],
                'ongoing': ['completed', 'cancelled'],
                'completed': [],
                'cancelled': []
            };

            if (!validStatusTransitions[interview.status]?.includes(status)) {
                throw new ApiError(`Invalid status transition from ${interview.status} to ${status}`, 400);
            }

            interview.status = status;
            const updatedInterview = await interview.save();

            // Update user metadata if needed
            const user = await User.findById(userId);
            if (user) {
                await user.updateInterviewMetadata(status);
            }

            return updatedInterview;
        } catch (error) {
            throw new ApiError(`Failed to update interview status: ${error.message}`, 400);
        }
    }

    // Advanced interview analytics
    async getInterviewAnalytics(userId, role) {
        try {
            const baseQuery = role === 'admin' ? {} : { createdBy: userId };

            const analytics = {
                totalInterviews: await Interview.countDocuments(baseQuery),
                interviewsByStatus: await Interview.aggregate([
                    { $match: baseQuery },
                    { 
                        $group: { 
                            _id: '$status', 
                            count: { $sum: 1 } 
                        } 
                    }
                ]),
                interviewsByType: await Interview.aggregate([
                    { $match: baseQuery },
                    { 
                        $group: { 
                            _id: '$interviewType', 
                            count: { $sum: 1 } 
                        } 
                    }
                ])
            };

            return analytics;
        } catch (error) {
            throw new ApiError(`Failed to generate interview analytics: ${error.message}`, 500);
        }
    }
}

module.exports = new InterviewService();