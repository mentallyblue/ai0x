const express = require('express');
const limiter = require('./middleware/rateLimiter');
const { validateGitHubUrl } = require('./middleware/validateRequest');

// Apply rate limiter to all routes
app.use('/api/', limiter);

// Apply validation to analyze endpoint
app.post('/api/analyze', validateGitHubUrl, async (req, res) => {
    // ... existing code
}); 