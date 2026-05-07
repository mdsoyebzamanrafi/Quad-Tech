import cloudinary from '../config/cloudinary.js';

const logCloudCloset = (...args) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[Cloud Closet]', ...args);
    }
};

const ensureCloudinaryConfigured = () => {
    logCloudCloset('Checking Cloudinary configuration', {
        hasCloudName: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
        hasApiKey: Boolean(process.env.CLOUDINARY_API_KEY),
        hasApiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
    });

    if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
    ) {
        throw new Error('Cloudinary configuration is missing.');
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
};

const uploadImageBuffer = ({ buffer, folder, originalFilename }) => {
    ensureCloudinaryConfigured();
    logCloudCloset('Starting Cloudinary upload', {
        folder,
        originalFilename,
        bufferBytes: buffer?.length || 0,
    });

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                use_filename: Boolean(originalFilename),
                unique_filename: true,
                overwrite: false,
            },
            (error, result) => {
                if (error) {
                    logCloudCloset('Cloudinary upload failed', {
                        message: error.message,
                        httpCode: error.http_code,
                        name: error.name,
                    });
                    reject(error);
                    return;
                }

                logCloudCloset('Cloudinary upload completed', {
                    publicId: result.public_id,
                    secureUrl: result.secure_url,
                    bytes: result.bytes,
                    format: result.format,
                    resourceType: result.resource_type,
                });
                resolve(result);
            }
        );

        uploadStream.on('error', (error) => {
            logCloudCloset('Cloudinary upload stream error', {
                message: error.message,
                name: error.name,
            });
        });

        uploadStream.end(buffer);
    });
};

const deleteImage = async (publicId) => {
    if (!publicId) {
        return null;
    }

    ensureCloudinaryConfigured();
    logCloudCloset('Deleting Cloudinary image', { publicId });
    return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
};

export { uploadImageBuffer, deleteImage };
