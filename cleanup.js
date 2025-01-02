require('dotenv').config();
const mongoose = require('mongoose');
const Repository = require('./models/Repository');

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        const result = await Repository.deleteMany({});
        console.log(`Deleted ${result.deletedCount} repository records`);

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Cleanup complete, connection closed');
    }
}

cleanup(); 