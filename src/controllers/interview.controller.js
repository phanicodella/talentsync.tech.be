const Interview = require('../models/interview.model');

// Get all interviews
const getAllInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find().sort({ interviewDate: -1 });
        res.json(interviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new interview
const createInterview = async (req, res) => {
    try {
        const interview = new Interview(req.body);
        const savedInterview = await interview.save();
        res.status(201).json(savedInterview);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update interview status
const updateInterviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const interview = await Interview.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        res.json(interview);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete interview
const deleteInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const interview = await Interview.findByIdAndDelete(id);
        
        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        res.json({ message: 'Interview deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllInterviews,
    createInterview,
    updateInterviewStatus,
    deleteInterview
};