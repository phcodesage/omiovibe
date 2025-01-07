const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');
const path = require('path');
const app = express();

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true
}));

const server = http.createServer(app);

// Initialize PeerJS server with better configuration
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/myapp',
  allow_discovery: true,
  proxied: true,
  expire_timeout: 5000,
  alive_timeout: 60000,
  key: 'peerjs',
  concurrent_limit: 5000
});

app.use('/peerjs', peerServer);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const waitingUsers = new Set();
const activeRooms = new Map(); // Track active rooms and their participants

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('ice-candidate', ({ candidate, roomId }) => {
    // Forward ICE candidate to the other peer in the room
    const roomParticipants = activeRooms.get(roomId) || [];
    const partner = roomParticipants.find(id => id !== socket.id);
    if (partner) {
      io.to(partner).emit('ice-candidate', { candidate });
    }
  });

  socket.on('find-partner', () => {
    // Remove from previous room if any
    const previousRoom = [...socket.rooms].find(room => room !== socket.id);
    if (previousRoom) {
      socket.leave(previousRoom);
      const roomParticipants = activeRooms.get(previousRoom) || [];
      const updatedParticipants = roomParticipants.filter(id => id !== socket.id);
      
      if (updatedParticipants.length === 0) {
        activeRooms.delete(previousRoom);
      } else {
        activeRooms.set(previousRoom, updatedParticipants);
        // Notify the other participant
        io.to(updatedParticipants[0]).emit('partner-left');
      }
    }

    // Find new partner
    if (waitingUsers.size > 0) {
      const partner = Array.from(waitingUsers)[0];
      waitingUsers.delete(partner);
      
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      socket.join(roomId);
      io.sockets.sockets.get(partner)?.join(roomId);
      
      activeRooms.set(roomId, [socket.id, partner]);
      
      console.log(`Room ${roomId} created with users:`, socket.id, partner);
      
      // Notify both users
      socket.emit('partner-found', { partnerId: partner, roomId });
      io.to(partner).emit('partner-found', { partnerId: socket.id, roomId });
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

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all routes - serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 