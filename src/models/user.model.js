// backend/src/models/user.model.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false // Don't include password in queries by default
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot be more than 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot be more than 50 characters']
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'interviewer', 'recruiter'],
            message: '{VALUE} is not a valid role'
        },
        default: 'interviewer'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date,
    preferences: {
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            inApp: {
                type: Boolean,
                default: true
            }
        },
        timezone: {
            type: String,
            default: 'UTC'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    metadata: {
        createdInterviews: {
            type: Number,
            default: 0
        },
        completedInterviews: {
            type: Number,
            default: 0
        },
        lastInterviewDate: Date
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'metadata.lastInterviewDate': -1 });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
    // Only hash password if it has been modified
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Generate salt
        const salt = await bcrypt.genSalt(10);
        // Hash password
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
    // Reset attempts if lock has expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: {
                loginAttempts: 1
            },
            $unset: {
                lockUntil: 1
            }
        });
    }

    // Otherwise increment attempts
    const updates = {
        $inc: {
            loginAttempts: 1
        }
    };

    // Lock account if attempts exceed 5
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = {
            lockUntil: Date.now() + 3600000 // Lock for 1 hour
        };
    }

    return await this.updateOne(updates);
};

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to update metadata after interview
userSchema.methods.updateInterviewMetadata = async function(status) {
    const updates = {
        $inc: {
            'metadata.createdInterviews': 1
        },
        $set: {
            'metadata.lastInterviewDate': new Date()
        }
    };

    if (status === 'completed') {
        updates.$inc['metadata.completedInterviews'] = 1;
    }

    return await this.updateOne(updates);
};

// Static method to find active users by role
userSchema.statics.findActiveByRole = function(role) {
    return this.find({ role, isActive: true });
};

// Instance method to update preferences
userSchema.methods.updatePreferences = async function(preferences) {
    this.preferences = {
        ...this.preferences,
        ...preferences
    };
    return await this.save();
};

module.exports = mongoose.model('User', userSchema);
