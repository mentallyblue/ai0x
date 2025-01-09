const discordBot = require('./discord/bot');

// Start Discord bot
discordBot.start();

// Add error handlers
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
}); 