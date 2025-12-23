export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum size is 10MB.',
            error: err.message
        });
    }

    if (err.message === 'Only PDF files are allowed') {
        return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only PDF files are allowed.',
            error: err.message
        });
    }

    // Prisma errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            success: false,
            message: 'Resource already exists',
            error: err.message
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            message: 'Resource not found',
            error: err.message
        });
    }

    // Validation errors
    if (err.name === 'ZodError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.errors
        });
    }

    // Default error
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

export const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
};
