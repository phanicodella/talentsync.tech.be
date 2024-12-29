// backend/src/controllers/interview.controller.js
const Interview = require('../models/interview.model');
const User = require('../models/user.model');
const { ApiError } = require('../middleware/error.middleware');

// Get all interviews with advanced filtering and pagination
exports.getAllInterviews = async (req, res, next) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'interviewDate', 
            sortOrder = 'desc',
            status,
            type
        } = req.query;

        // Build query object
        const query = {};
        if (status) query.status = status;
        if (type) query.interviewType = type;

        // Determine if user is admin or filtering by their own interviews
        if (req.user.role !== 'admin') {
            query.createdBy = req.user._id;
        }

        // Pagination and sorting
        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
            select: '-__v'
        };

        const result = await Interview.paginate(query, options);

        res.json({
            success: true,
            totalInterviews: result.totalDocs,
            totalPages: result.totalPages,
            currentPage: result.page,
            interviews: result.docs
        });
    } catch (error) {
        next(new ApiError('Failed to retrieve interviews', 500));
    }
};

// Create a new interview
exports.createInterview = async (req, res, next) => {
    try {
        const interviewData = {
            ...req.body,
            createdBy: req.user._id
        };

        const interview = new Interview(interviewData);
        await interview.save();

        // Update user's interview metadata
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'metadata.createdInterviews': 1 },
            'metadata.lastInterviewDate': new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Interview created successfully',
            interview
        });
    } catch (error) {
        next(new ApiError('Failed to create interview', 400));
    }
};

// Update interview status
exports.updateInterviewStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const interview = await Interview.findById(id);
        if (!interview) {
            return next(new ApiError('Interview not found', 404));
        }

        // Validate status transition
        const validStatusTransitions = {
            'scheduled': ['ongoing', 'cancelled'],
            'ongoing': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': []
        };

        if (!validStatusTransitions[interview.status]?.includes(status)) {
            return next(new ApiError(`Invalid status transition from ${interview.status} to ${status}`, 400));
        }

        interview.status = status;
        await interview.save();

        // Update user metadata if needed
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 
                'metadata.completedInterviews': status === 'completed' ? 1 : 0 
            }
        });

        res.json({
            success: true,
            message: 'Interview status updated successfully',
            interview
        });
    } catch (error) {
        next(new ApiError('Failed to update interview status', 400));
    }
};

// Delete an interview
exports.deleteInterview = async (req, res, next) => {
    try {
        const { id } = req.params;

        const interview = await Interview.findByIdAndDelete(id);
        if (!interview) {
            return next(new ApiError('Interview not found', 404));
        }

        res.json({
            success: true,
            message: 'Interview deleted successfully',
            deletedId: id
        });
    } catch (error) {
        next(new ApiError('Failed to delete interview', 400));
    }
};

// Get interview by ID
exports.getInterviewById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const interview = await Interview.findById(id);
        if (!interview) {
            return next(new ApiError('Interview not found', 404));
        }

        // Ensure user can only access their own interviews or admin can access all
        if (req.user.role !== 'admin' && !interview.createdBy.equals(req.user._id)) {
            return next(new ApiError('Unauthorized access', 403));
        }

        res.json({
            success: true,
            interview
        });
    } catch (error) {
        next(new ApiError('Failed to retrieve interview', 500));
    }
};

// Get interview analytics
exports.getInterviewAnalytics = async (req, res, next) => {
    try {
        const userId = req.user.role === 'admin' ? null : req.user._id;

        const query = userId ? { createdBy: userId } : {};

        const analytics = {
            totalInterviews: await Interview.countDocuments(query),
            interviewsByStatus: await Interview.aggregate([
                { $match: query },
                { 
                    $group: { 
                        _id: '$status', 
                        count: { $sum: 1 } 
                    } 
                }
            ]),
            interviewsByType: await Interview.aggregate([
                { $match: query },
                { 
                    $group: { 
                        _id: '$interviewType', 
                        count: { $sum: 1 } 
                    } 
                }
            ])
        };

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        next(new ApiError('Failed to generate interview analytics', 500));
    }
};