import mongoose from 'mongoose';
import ApiError from '../errors/ApiError.js';

const notFound = (req, res, next) => {
    next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            message: err.message,
            details: err.details,
        });
    }

    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ message: 'Invalid identifier format' });
    }

    if (err.code === 11000) {
        return res.status(409).json({ message: 'Duplicate resource conflict' });
    }

    const statusCode = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    return res.status(statusCode).json({ message });
};

export { notFound, errorHandler };
