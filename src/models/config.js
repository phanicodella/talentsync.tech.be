const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption utility
const algorithm = 'aes-256-cbc';
const secretKey = process.env.CONFIG_ENCRYPTION_KEY || crypto.randomBytes(32);
const iv = crypto.randomBytes(16);

function encrypt(text) {
    if (!text) return null;
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return null;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

const ConfigSchema = new mongoose.Schema({
    key: { 
        type: String, 
        required: true,
        unique: true,
        trim: true
    },
    value: { 
        type: String, 
        required: true,
        set: encrypt,
        get: decrypt
    },
    type: {
        type: String,
        enum: ['system', 'openai', 'external'],
        default: 'system'
    },
    description: {
        type: String,
        trim: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    toJSON: { getters: true },
    toObject: { getters: true }
});

// Indexing for performance
ConfigSchema.index({ key: 1, type: 1 });

// Validation middleware
ConfigSchema.pre('save', function(next) {
    // Additional validation logic if needed
    this.lastUpdated = new Date();
    next();
});

// Static methods for common operations
ConfigSchema.statics.getConfigValue = async function(key, type = 'system') {
    const config = await this.findOne({ key, type });
    return config ? config.value : null;
};

ConfigSchema.statics.setConfigValue = async function(key, value, type = 'system', userId = null, description = '') {
    const existingConfig = await this.findOne({ key, type });
    
    if (existingConfig) {
        existingConfig.value = value;
        existingConfig.updatedBy = userId;
        existingConfig.description = description;
        await existingConfig.save();
        return existingConfig;
    }
    
    return this.create({
        key,
        value,
        type,
        updatedBy: userId,
        description
    });
};

module.exports = mongoose.model('Config', ConfigSchema);