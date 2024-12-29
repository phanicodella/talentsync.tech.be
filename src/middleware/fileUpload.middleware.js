// backend/src/middleware/fileUpload.middleware.js
const multer = require('multer');
const { ApiError } = require('./error.middleware');

class FileUploadMiddleware {
    constructor() {
        this.storage = multer.memoryStorage();
        this.upload = multer({
            storage: this.storage,
            limits: {
                fileSize: 500 * 1024 * 1024 // 500MB max file size
            }
        });
    }

    // Single file upload with validation
    single(fieldName, options = {}) {
        return [
            this.upload.single(fieldName),
            (req, res, next) => {
                try {
                    if (!req.file) {
                        throw new ApiError(`No ${fieldName} file uploaded`, 400);
                    }

                    this.validateFile(req.file, options);
                    next();
                } catch (error) {
                    next(error);
                }
            }
        ];
    }

    // Multiple files upload with validation
    array(fieldName, maxCount, options = {}) {
        return [
            this.upload.array(fieldName, maxCount),
            (req, res, next) => {
                try {
                    if (!req.files || req.files.length === 0) {
                        throw new ApiError(`No ${fieldName} files uploaded`, 400);
                    }

                    req.files.forEach(file => this.validateFile(file, options));
                    next();
                } catch (error) {
                    next(error);
                }
            }
        ];
    }

    // File validation
    validateFile(file, options = {}) {
        const {
            maxSize = 100 * 1024 * 1024, // 100MB default
            minSize = 1024, // 1KB default
            allowedTypes = [],
            allowedExtensions = []
        } = options;

        // Check file size
        if (file.size > maxSize) {
            throw new ApiError(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`, 400);
        }

        if (file.size < minSize) {
            throw new ApiError(`File too small. Minimum size is ${minSize / 1024}KB`, 400);
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
            throw new ApiError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, 400);
        }

        // Check file extension
        if (allowedExtensions.length > 0) {
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                throw new ApiError(`Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`, 400);
            }
        }

        return true;
    }

    // File type checkers
    static isImage(file) {
        return file.mimetype.startsWith('image/');
    }

    static isVideo(file) {
        return file.mimetype.startsWith('video/');
    }

    static isAudio(file) {
        return file.mimetype.startsWith('audio/');
    }

    static isPDF(file) {
        return file.mimetype === 'application/pdf';
    }

    // Helper methods
    static getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    static generateFileName(