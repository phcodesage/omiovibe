const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const app = express();
app.use(cors());

const server = http.createServer(app);

// Initialize PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/myapp'
});

app.use('/peerjs', peerServer);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const waitingUsers = new Set();
const activeRooms = new Map(); // Track active rooms and their participants

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find-partner', () => {
    // If user was in a room, remove them
    const previousRoom = [...socket.rooms].find(room => room !== socket.id);
    if (previousRoom) {
      socket.leave(previousRoom);
      const roomParticipants = activeRooms.get(previousRoom) || [];
      const updatedParticipants = roomParticipants.filter(id => id !== socket.id);
      
      if (updatedParticipants.length === 0) {
        activeRooms.delete(previousRoom);
      } else {
        activeRooms.set(previousRoom, updatedParticipants);
      }
    }

    if (waitingUsers.size > 0) {
      const partner = Array.from(waitingUsers)[0];
      waitingUsers.delete(partner);
      
      // Create a new room
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      socket.join(roomId);
      io.sockets.sockets.get(partner)?.join(roomId);
      
      // Store room participants
      activeRooms.set(roomId, [socket.id, partner]);
      
      // Notify both users
      socket.emit('partner-found', { partnerId: partner, roomId });
      io.to(partner).emit('partner-found', { partnerId: socket.id, roomId });
      
      console.log(`Room ${roomId} created with users:`, socket.id, partner);
    } else {
      waitingUsers.add(socket.id);
      console.log('User added to waiting list:', socket.id);
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId);
    const roomParticipants = activeRooms.get(roomId) || [];
    const partner = roomParticipants.find(id => id !== socket.id);
    
    if (partner) {
      io.to(partner).emit('partner-left');
    }
    
    activeRooms.delete(roomId);
    console.log(`User ${socket.id} left room ${roomId}`);
  });

  socket.on('disconnect', () => {
    // Remove from waiting list if they were waiting
    waitingUsers.delete(socket.id);
    
    // Notify partner in any active room
    for (const [roomId, participants] of activeRooms.entries()) {
      if (participants.includes(socket.id)) {
        const partner = participants.find(id => id !== socket.id);
        if (partner) {
          io.to(partner).emit('partner-left');
        }
        activeRooms.delete(roomId);
      }
    }
    
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'dist')));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 