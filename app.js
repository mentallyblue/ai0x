const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// Make io available globally
global.io = io;

// ... rest of your Express configuration ...

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 

io.on('connection', (socket) => {
    // Send initial queue status
    socket.emit('queueUpdate', { count: getQueueCount() });

    // Handle analysis requests
    socket.on('analyzeRepository', async (data) => {
        // Your existing analysis logic
    });
});

// Update queue status whenever it changes
function updateQueueStatus() {
    io.emit('queueUpdate', { count: getQueueCount() });
} 