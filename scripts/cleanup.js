require('dotenv').config();
const mongoose = require('mongoose');
const Repository = require('../models/Repository');

async function cleanup() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear all repository analyses
        await Repository.deleteMany({});
        console.log('✅ Cleared all repository analyses');

        // Clear any in-memory queue data by restarting the server
        console.log('\n🔄 Now restart the server with:');
        console.log('npm start');

    } catch (error) {
        console.error('❌ Cleanup error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

cleanup(); 