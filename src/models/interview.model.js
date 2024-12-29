
const mongoose = require('mongoose');
const interviewSchema = new mongoose.Schema({
    candidateName: {
        type: String,
        required: [true, 'Candidate name is required'],
        trim: true,
        maxlength: [100, 'Candidate name cannot exceed 100 characters']
    },
    candidateEmail: {
        type: String,
        required: [true, 'Candidate email is required'],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    candidatePhone: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return v === '' || /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    interviewDate: {
        type: Date,
        required: [true, 'Interview date is required'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: 'Interview date must be in the future'
        }
    },
    interviewType: {
        type: String,
        required: [true, 'Interview type is required'],
        enum: {
            values: ['technical', 'hr', 'final'],
            message: '{VALUE} is not a valid interview type'
        }
    },
    status: {
        type: String,
        default: 'scheduled',
        enum: {
            values: ['scheduled', 'ongoing', 'completed', 'cancelled'],
            message: '{VALUE} is not a valid status'
        }
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Interview must be created by a user']
    },
    metadata: {
        interviewRecording: {
            url: String,
            size: Number,
            type: String
        },
        transcriptUrl: String,
        aiAnalysis: {
            suspicionScore: Number,
            confidence: Number,
            behavioralInsights: {}
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});