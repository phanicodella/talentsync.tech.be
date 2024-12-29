// backend/src/services/s3.service.js
const AWS = require('aws-sdk');
const config = require('../config/env.config');
const { ApiError } = require('../middleware/error.middleware');

class S3Service {
    constructor() {
        this.s3 = new AWS.S3({
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
            region: config.aws.region
        });

        this.bucket = config.aws.bucket;
        this.cdnDomain = config.aws.cdnDomain;
    }

    async uploadFile(file, key, options = {}) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.sanitizeKey(key),
                Body: file.buffer || file,
                ContentType: file.mimetype || options.contentType,
                ACL: options.public ? 'public-read' : 'private',
                Metadata: {
                    originalname: file.originalname || 'unknown',
                    uploadedBy: options.uploadedBy || 'system'
                }
            };

            // Add encryption if enabled
            if (config.aws.encryption) {
                params.ServerSideEncryption = 'AES256';
            }

            const result = await this.s3.upload(params).promise();
            
            return {
                key: result.Key,
                location: result.Location,
                cdnUrl: this.cdnDomain ? `https://${this.cdnDomain}/${result.Key}` : result.Location
            };
        } catch (error) {
            console.error('S3 upload error:', error);
            throw new ApiError('Failed to upload file', 500);
        }
    }

    async getSignedUrl(key, expiresIn = 3600) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.sanitizeKey(key),
                Expires: expiresIn
            };

            const url = await this.s3.getSignedUrlPromise('getObject', params);
            return url;
        } catch (error) {
            console.error('S3 signed URL error:', error);
            throw new ApiError('Failed to generate signed URL', 500);
        }
    }

    async deleteFile(key) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.sanitizeKey(key)
            };

            await this.s3.deleteObject(params).promise();
            return true;
        } catch (error) {
            console.error('S3 delete error:', error);
            throw new ApiError('Failed to delete file', 500);
        }
    }

    async copyFile(sourceKey, destinationKey) {
        try {
            const params = {
                Bucket: this.bucket,
                CopySource: `/${this.bucket}/${this.sanitizeKey(sourceKey)}`,
                Key: this.sanitizeKey(destinationKey)
            };

            const result = await this.s3.copyObject(params).promise();
            return {
                key: destinationKey,
                location: `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${destinationKey}`,
                cdnUrl: this.cdnDomain ? `https://${this.cdnDomain}/${destinationKey}` : null
            };
        } catch (error) {
            console.error('S3 copy error:', error);
            throw new ApiError('Failed to copy file', 500);
        }
    }

    async listFiles(prefix = '', maxKeys = 1000) {
        try {
            const params = {
                Bucket: this.bucket,
                Prefix: this.sanitizeKey(prefix),
                MaxKeys: maxKeys
            };

            const result = await this.s3.listObjectsV2(params).promise();
            return result.Contents.map(item => ({
                key: item.Key,
                size: item.Size,
                lastModified: item.LastModified,
                url: this.cdnDomain ? 
                    `https://${this.cdnDomain}/${item.Key}` : 
                    `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${item.Key}`
            }));
        } catch (error) {
            console.error('S3 list error:', error);
            throw new ApiError('Failed to list files', 500);
        }
    }

    async getFileMetadata(key) {
        try {
            const params = {
                Bucket: this.bucket,
                Key: this.sanitizeKey(key)
            };

            const result = await this.s3.headObject(params).promise();
            return {
                contentType: result.ContentType,
                contentLength: result.ContentLength,
                lastModified: result.LastModified,
                metadata: result.Metadata
            };
        } catch (error) {
            console.error('S3 metadata error:', error);
            throw new ApiError('Failed to get file metadata', 500);
        }
    }

    sanitizeKey(key) {
        // Remove leading slashes and normalize path separators
        return key.replace(/^\/+/, '').replace(/\\/g, '/');
    }

    getPublicUrl(key) {
        if (this.cdnDomain) {
            return `https://${this.cdnDomain}/${this.sanitizeKey(key)}`;
        }
        return `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${this.sanitizeKey(key)}`;
    }

    // Utility methods for common operations
    async uploadVideo(file, folder = 'videos') {
        const key = `${folder}/${Date.now()}-${file.originalname}`;
        return this.uploadFile(file, key, { contentType: 'video/webm' });
    }

    async uploadImage(file, folder = 'images') {
        const key = `${folder}/${Date.now()}-${file.originalname}`;
        return this.uploadFile(file, key, { public: true });
    }

    async uploadDocument(file, folder = 'documents') {
        const key = `${folder}/${Date.now()}-${file.originalname}`;
        return this.uploadFile(file, key);
    }

    // Error handler wrapper
    static wrapError(error) {
        if (error.code === 'NoSuchKey') {
            return new ApiError('File not found', 404);
        }
        if (error.code === 'NoSuchBucket') {
            return new ApiError('Storage bucket not found', 500);
        }
        if (error.code === 'AccessDenied') {
            return new ApiError('Access denied to file', 403);
        }
        return new ApiError('Storage operation failed', 500);
    }
}

module.exports = new S3Service();
