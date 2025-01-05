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
const { startBot: startDiscordBot } = require('./bots/discordBot');
const { startBot: startTelegramBot } = require('./bots/telegramBot');
const v8 = require('v8');

// Set up middleware
app.use(express.json());
app.use(express.static('public'));

// Set up Socket.IO
global.io = io;

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
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

// Add memory monitoring
setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const heapUsed = (heapStats.used_heap_size / heapStats.heap_size_limit) * 100;
    
    console.log(`Memory usage: ${heapUsed.toFixed(2)}%`);
    
    if (heapUsed > 90) {
        console.warn('High memory usage detected!');
        global.gc && global.gc(); // Force garbage collection if available
    }
}, 300000); // Check every 5 minutes

// Rest of your existing routes...
app.use('/api', apiRouter);

// Update MongoDB connection settings
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    keepAlive: true,
    keepAliveInitialDelay: 300000
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Add reconnection handling
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
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

// Add environment check
const isProduction = process.env.NODE_ENV === 'production';

// Replace the bot startup section with this:
if (isProduction) {
    // Only start bots in production
    startDiscordBot();
    startTelegramBot();
    console.log('Started bots in production mode');
} else {
    // In development, only start Discord bot if needed
    startDiscordBot();
    console.log('Development mode: Telegram bot disabled');
}

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${isProduction ? 'production' : 'development'} mode`);
});

// Add error handling for the HTTP server
http.on('error', (error) => {
    console.error('HTTP Server error:', error);
});

// Add proper shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    http.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Add near the top with other routes
app.get('/health', (req, res) => {
    // Check MongoDB connection
    const isDbConnected = mongoose.connection.readyState === 1;
    
    if (isDbConnected) {
        res.status(200).json({ status: 'healthy', db: 'connected' });
    } else {
        res.status(503).json({ status: 'unhealthy', db: 'disconnected' });
    }
}); 