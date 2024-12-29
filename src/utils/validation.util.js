// backend/src/utils/validation.util.js
const validator = require('validator');

class ValidationUtil {
    // Email validation
    static isValidEmail(email) {
        return validator.isEmail(email);
    }

    // Password strength validation
    static isStrongPassword(password) {
        return validator.isStrongPassword(password, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        });
    }

    // Phone number validation
    static isValidPhoneNumber(phone) {
        // Supports international phone number formats
        return validator.isMobilePhone(phone, 'any');
    }

    // URL validation
    static isValidURL(url) {
        return validator.isURL(url, {
            require_protocol: true,
            require_valid_protocol: true
        });
    }

    // Date validation
    static isValidDate(date) {
        return validator.isDate(date);
    }

    // Sanitize input
    static sanitizeInput(input) {
        return validator.escape(input.trim());
    }

    // Validate interview details
    static validateInterviewData(data) {
        const errors = [];

        if (!data.candidateName || data.candidateName.trim().length < 2) {
            errors.push('Invalid candidate name');
        }

        if (!this.isValidEmail(data.candidateEmail)) {
            errors.push('Invalid email address');
        }

        if (data.candidatePhone && !this.isValidPhoneNumber(data.candidatePhone)) {
            errors.push('Invalid phone number');
        }

        if (!this.isValidDate(data.interviewDate)) {
            errors.push('Invalid interview date');
        }

        const validTypes = ['technical', 'hr', 'final'];
        if (!validTypes.includes(data.interviewType)) {
            errors.push('Invalid interview type');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = ValidationUtil;