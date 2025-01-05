const mongoose = require('mongoose');
const { init: initTweetHistory } = require('../models/TweetHistory');

const connectDB = async () => {
    try {
        // Main application database
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected successfully');

        // Create a separate connection for tweet history
        const tweetHistoryConnection = mongoose.createConnection(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: 'ai0x_tweets'
        });

        // Initialize the TweetHistory model with the connection
        const TweetHistory = initTweetHistory(tweetHistoryConnection);
        
        // Make both available globally if needed
        global.tweetHistoryDB = tweetHistoryConnection;
        global.TweetHistory = TweetHistory;

        console.log('Tweet history database connected successfully');

    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB; 