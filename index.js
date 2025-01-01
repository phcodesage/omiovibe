const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST"]
  }
});

const waitingUsers = new Set();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find-partner', () => {
    if (waitingUsers.size > 0) {
      const partner = Array.from(waitingUsers)[0];
      waitingUsers.delete(partner);
      
      socket.emit('partner-found', partner);
      io.to(partner).emit('partner-found', socket.id);
    } else {
      waitingUsers.add(socket.id);
    }
  });

  socket.on('send-signal', ({ userToSignal, signal }) => {
    io.to(userToSignal).emit('receive-signal', { signal });
  });

  socket.on('disconnect', () => {
    waitingUsers.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});


app.get('/', (req, res) => {
  res.send('Hello Test');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 