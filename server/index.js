import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Store waiting users and active chats
const waitingUsers = new Set();
const activeChats = new Map();
const userSockets = new Map();

// Chat room class
class ChatRoom {
  constructor(user1, user2) {
    this.id = uuidv4();
    this.users = [user1, user2];
    this.messages = [];
    this.createdAt = new Date();
  }

  addMessage(userId, message) {
    const msg = {
      id: uuidv4(),
      userId,
      message,
      timestamp: new Date()
    };
    this.messages.push(msg);
    return msg;
  }

  getOtherUser(userId) {
    return this.users.find(user => user !== userId);
  }
}

// Find a match for waiting user
function findMatch(currentUser) {
  for (const waitingUser of waitingUsers) {
    if (waitingUser !== currentUser) {
      waitingUsers.delete(waitingUser);
      waitingUsers.delete(currentUser);
      return waitingUser;
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  userSockets.set(socket.id, socket);

  // User wants to find a chat
  socket.on('find-chat', (userData) => {
    const userId = socket.id;
    
    // Check if user is already in a chat
    if (activeChats.has(userId)) {
      socket.emit('error', { message: 'Already in an active chat' });
      return;
    }

    // Try to find a match
    const match = findMatch(userId);
    
    if (match) {
      // Create new chat room
      const chatRoom = new ChatRoom(userId, match);
      activeChats.set(userId, chatRoom);
      activeChats.set(match, chatRoom);

      // Get sockets for both users
      const userSocket = userSockets.get(userId);
      const matchSocket = userSockets.get(match);

      if (userSocket && matchSocket) {
        // Join both users to the chat room
        userSocket.join(chatRoom.id);
        matchSocket.join(chatRoom.id);

        // Notify both users
        userSocket.emit('chat-found', {
          roomId: chatRoom.id,
          stranger: 'Stranger'
        });
        
        matchSocket.emit('chat-found', {
          roomId: chatRoom.id,
          stranger: 'Stranger'
        });

        console.log(`Chat created: ${userId} and ${match} in room ${chatRoom.id}`);
      }
    } else {
      // Add to waiting list
      waitingUsers.add(userId);
      socket.emit('waiting', { message: 'Looking for someone to chat with...' });
      console.log('User waiting:', userId);
    }
  });

  // Handle chat messages
  socket.on('send-message', (data) => {
    const userId = socket.id;
    const chatRoom = activeChats.get(userId);

    if (!chatRoom) {
      socket.emit('error', { message: 'No active chat found' });
      return;
    }

    const message = chatRoom.addMessage(userId, data.message);
    
    // Send message to both users in the chat
    io.to(chatRoom.id).emit('new-message', {
      id: message.id,
      message: message.message,
      senderId: userId,
      timestamp: message.timestamp
    });
  });

  // Handle typing indicators
  socket.on('typing', (isTyping) => {
    const userId = socket.id;
    const chatRoom = activeChats.get(userId);

    if (chatRoom) {
      const otherUser = chatRoom.getOtherUser(userId);
      const otherSocket = userSockets.get(otherUser);
      
      if (otherSocket) {
        otherSocket.emit('stranger-typing', isTyping);
      }
    }
  });

  // Handle chat disconnect
  socket.on('disconnect-chat', () => {
    const userId = socket.id;
    const chatRoom = activeChats.get(userId);

    if (chatRoom) {
      const otherUser = chatRoom.getOtherUser(userId);
      const otherSocket = userSockets.get(otherUser);

      // Notify the other user
      if (otherSocket) {
        otherSocket.emit('stranger-disconnected');
        otherSocket.leave(chatRoom.id);
      }

      // Clean up
      activeChats.delete(userId);
      activeChats.delete(otherUser);
      socket.leave(chatRoom.id);

      console.log('Chat disconnected:', chatRoom.id);
    }
  });

  // Handle socket disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const userId = socket.id;
    
    // Remove from waiting list
    waitingUsers.delete(userId);
    
    // Handle active chat disconnection
    const chatRoom = activeChats.get(userId);
    if (chatRoom) {
      const otherUser = chatRoom.getOtherUser(userId);
      const otherSocket = userSockets.get(otherUser);

      if (otherSocket) {
        otherSocket.emit('stranger-disconnected');
        otherSocket.leave(chatRoom.id);
      }

      activeChats.delete(userId);
      activeChats.delete(otherUser);
    }

    // Clean up user socket reference
    userSockets.delete(userId);
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});