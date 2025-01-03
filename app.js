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