// backend/src/utils/encryption.util.js
const crypto = require('crypto');

class EncryptionUtil {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.secretKey = process.env.ENCRYPTION_SECRET || crypto.randomBytes(32);
    }

    // Encrypt data
    encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag().toString('hex');
            
            return {
                iv: iv.toString('hex'),
                content: encrypted,
                authTag
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Encryption failed');
        }
    }

    // Decrypt data
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipheriv(
                this.algorithm, 
                this.secretKey, 
                Buffer.from(encryptedData.iv, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            
            let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Decryption failed');
        }
    }

    // Generate secure random token
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    // Hash password
    hashPassword(password, salt = null) {
        salt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return { salt, hash };
    }

    // Verify password
    verifyPassword(password, salt, originalHash) {
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return hash === originalHash;
    }
}

module.exports = new EncryptionUtil();