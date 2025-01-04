require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const { analyzeRepo } = require('./services/analyzer');
const { extractRepoInfo } = require('./utils/githubUtils');
const Repository = require('./models/Repository');
const ApiKey = require('./models/ApiKey');
const apiRouter = require('./routes/api');
const { Anthropic } = require('@anthropic-ai/sdk');
const session = require('express-session');

// Set up middleware
app.use(express.json());
app.use(express.static('public'));

// Set up Socket.IO
global.io = io;

io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send current insights to newly connected clients
    if (currentInsights) {
        socket.emit('insightsUpdate', currentInsights);
    }

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });

    socket.on('requestInsightsRefresh', async () => {
        try {
            // Force a refresh of insights
            const response = await fetch(`http://localhost:${PORT}/api/insights`);
            const data = await response.json();
            io.emit('insightsUpdate', data);
        } catch (error) {
            console.error('Error refreshing insights:', error);
            socket.emit('insightsError', { message: 'Failed to refresh insights' });
        }
    });
});

// Now import queueTracker after Socket.IO is set up
const { queueTracker } = require('./services/queueService');

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

// Add these variables at the top
let currentInsights = null;
let lastInsightUpdate = null;
const UPDATE_INTERVAL = 3600000 * 4; // Check every 4 hours

// Rest of your existing routes...
app.use('/api', apiRouter);

// Update MongoDB connection settings
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Add proper session configuration
app.use(session({
    secret: 'your_secret_key',
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    resave: false,
    saveUninitialized: false
}));

// Add error handling for authentication
app.use((err, req, res, next) => {
    if (err.message === 'Failed to find request token in session') {
        console.error('Authentication error:', err);
        return res.redirect('/login?error=auth_failed');
    }
    next(err);
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 