const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    // In production, don't hand callers raw error internals (stack-adjacent messages, driver
    // errors, etc). Development keeps the real message since that's what you're debugging with.
    const message = process.env.NODE_ENV === "production"
        ? "Something went wrong. Please try again later."
        : (err.message || "Server Error");

    res.status(statusCode).json({
        success: false,
        message
    });
};

module.exports = errorHandler;