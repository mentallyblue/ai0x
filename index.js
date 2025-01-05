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
const MongoStore = require('connect-mongo');
const Scheduler = require('./services/scheduler');

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

// Connect to MongoDB
connectDB();

// Add memory monitoring
setInterval(() => {
    const heapStats = v8.getHeapStatistics();
    const heapUsed = (heapStats.used_heap_size / heapStats.heap_size_limit) * 100;
    
    console.log(`Memory usage: ${heapUsed.toFixed(2)}%`);
    
    if (heapUsed > 90) {
        console.warn('High memory usage detected!');
        global.gc && global.gc();
    }
}, 300000);

// Routes
app.use('/api', apiRouter);

// MongoDB connection
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

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60
    })
}));

// Error handling middleware
app.use((err, req, res, next) => {
    if (err.message === 'Failed to find request token in session') {
        console.error('Authentication error:', err);
        return res.redirect('/login?error=auth_failed');
    }
    next(err);
});

// Health check endpoint
app.get('/health', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (isDbConnected) {
        res.status(200).json({ status: 'healthy', db: 'connected' });
    } else {
        res.status(503).json({ status: 'unhealthy', db: 'disconnected' });
    }
});

// Initialize bots
const initializeBots = async () => {
    try {
        await startDiscordBot();
        
        // Only start Telegram bot in production
        if (process.env.NODE_ENV !== 'development') {
            try {
                await startTelegramBot();
                console.log('Telegram bot started successfully');
            } catch (error) {
                console.error('Failed to initialize Telegram bot:', error);
            }
        } else {
            console.log('Skipping Telegram bot initialization in development mode');
        }

        console.log('Bot initialization complete');
    } catch (error) {
        console.error('Error initializing bots:', error);
    }
};

// Start the application
const startApp = async () => {
    try {
        await connectDB();
        console.log('Connected to MongoDB');

        const port = process.env.PORT || 3000;
        http.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });

        await initializeBots();
    } catch (error) {
        console.error('Application startup error:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    http.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// This will start the tweet generation schedule
const schedulerInstance = new Scheduler();

startApp(); 