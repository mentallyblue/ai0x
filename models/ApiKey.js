const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    owner: String,
    requestsToday: { type: Number, default: 0 },
    lastRequest: Date,
    dailyLimit: { type: Number, default: 50 },
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('ApiKey', apiKeySchema); 