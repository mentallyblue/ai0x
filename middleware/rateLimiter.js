const rateLimit = require('express-rate-limit');

// Create a Map to track ongoing analyses per IP
const ongoingAnalyses = new Map();

// Middleware to check for ongoing analyses
const oneAnalysisPerIP = (req, res, next) => {
    const clientIP = req.ip;
    
    if (ongoingAnalyses.has(clientIP)) {
        return res.status(429).json({
            error: 'You already have an ongoing analysis. Please wait for it to complete.'
        });
    }
    
    // Add IP to tracking
    ongoingAnalyses.set(clientIP, Date.now());
    
    // Remove IP from tracking after timeout (5 minutes max)
    setTimeout(() => {
        ongoingAnalyses.delete(clientIP);
    }, 5 * 60 * 1000);
    
    next();
};

// Regular rate limiting
const queueLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 requests per minute
    message: {
        error: 'Too many requests. Please try again later.'
    }
});

// Export both middleware
module.exports = { 
    queueLimiter,
    oneAnalysisPerIP,
    // Helper to remove IP from tracking when analysis completes
    removeAnalysis: (ip) => ongoingAnalyses.delete(ip)
}; 