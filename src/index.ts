import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

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

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 