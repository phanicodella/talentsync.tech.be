// backend/src/config/aws.config.js
const config = {
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET,
        cdnDomain: process.env.AWS_CLOUDFRONT_DOMAIN || null,
        encryption: process.env.AWS_S3_ENCRYPTION === 'true',

        // Optional configurations
        endpoint: process.env.AWS_ENDPOINT, // For local development with MinIO
        s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
        
        // Upload configurations
        upload: {
            maxSize: parseInt(process.env.AWS_MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB default
            allowedTypes: (process.env.AWS_ALLOWED_FILE_TYPES || 'image/*,video/*,application/pdf').split(','),
            expiryTime: parseInt(process.env.AWS_SIGNED_URL_EXPIRY) || 3600, // 1 hour default
        },

        // Storage paths
        paths: {
            interviews: 'interviews',
            recordings: 'recordings',
            transcripts: 'transcripts',
            temp: 'temp'
        }
    },

    // Helper methods
    getUploadPath(type, id) {
        const timestamp = new Date().toISOString().split('T')[0];
        return `${config.aws.paths[type]}/${timestamp}/${id}`;
    },

    getSignedUrlExpiry() {
        return config.aws.upload.expiryTime;
    },

    isValidFileType(mimetype) {
        return config.aws.upload.allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                return mimetype.startsWith(type.slice(0, -2));
            }
            return type === mimetype;
        });
    },

    validateFileSize(size) {
        return size <= config.aws.upload.maxSize;
    }
};

module.exports = config;
