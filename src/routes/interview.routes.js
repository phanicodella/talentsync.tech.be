const express = require('express');
const router = express.Router();
const {
    getAllInterviews,
    createInterview,
    updateInterviewStatus,
    deleteInterview
} = require('../controllers/interview.controller');

// Get all interviews
router.get('/', getAllInterviews);

// Create new interview
router.post('/', createInterview);

// Update interview status
router.patch('/:id/status', updateInterviewStatus);

// Delete interview
router.delete('/:id', deleteInterview);

module.exports = router;