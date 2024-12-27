const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
    candidateName: {
        type: String,
        required: true,
        trim: true
    },
    candidateEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    candidatePhone: {
        type: String,
        trim: true
    },
    interviewDate: {
        type: Date,
        required: true
    },
    interviewType: {
        type: String,
        required: true,
        enum: ['technical', 'hr', 'final']
    },
    status: {
        type: String,
        default: 'scheduled',
        enum: ['scheduled', 'completed', 'cancelled']
    },
    notes: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Interview', interviewSchema);