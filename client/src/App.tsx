import { useEffect, useState } from 'react';
import { Socket, io } from 'socket.io-client';
import Peer from 'peerjs';
import { Box, Container } from '@mui/material';
import VideoCall from './components/VideoCall';
import Home from './components/Home';

const SERVER_URL = 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showHome, setShowHome] = useState(true);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    const newPeer = new Peer({
      host: 'localhost',
      port: 5000,
      path: '/peerjs/myapp',
    });

    setPeer(newPeer);

    return () => {
      newSocket.close();
      newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('partner-found', ({ partnerId: newPartnerId, roomId: newRoomId }) => {
      setPartnerId(newPartnerId);
      setRoomId(newRoomId);
      setIsSearching(false);
    });

    socket.on('partner-left', () => {
      setPartnerId(null);
      setRoomId(null);
    });

    return () => {
      socket.off('partner-found');
      socket.off('partner-left');
    };
  }, [socket]);

  const startSearch = async () => {
    try {
      const userMedia = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(userMedia);
      setIsSearching(true);
      setShowHome(false);
      socket?.emit('find-partner');
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const stopCall = () => {
    if (roomId) {
      socket?.emit('leave-room', { roomId });
    }
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setPartnerId(null);
    setRoomId(null);
    setIsSearching(false);
    setShowHome(true);
  };

  return (
    <Container maxWidth="lg" sx={{ minHeight: '100vh' }}>
      <Box sx={{ py: 2 }}>
        {showHome ? (
          <Home onStartChat={startSearch} />
        ) : (
          <Box sx={{ mt: 2 }}>
            <VideoCall
              stream={stream}
              peer={peer}
              socket={socket}
              partnerId={partnerId}
              roomId={roomId}
              isSearching={isSearching}
              onStopCall={stopCall}
            />
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default App;
