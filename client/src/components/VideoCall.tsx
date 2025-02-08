import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { Box, CircularProgress, Grid, Typography, Button } from '@mui/material';

interface VideoCallProps {
  stream: MediaStream;
  peer: Peer | null;
  socket: Socket | null;
  partnerId: string | null;
  roomId: string | null;
  isSearching: boolean;
  onStopCall: () => void;
}

const VideoCall = ({
  stream,
  peer,
  socket,
  partnerId,
  roomId,
  isSearching,
  onStopCall,
}: VideoCallProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (!peer || !socket || !partnerId || !stream) return;

    const call = peer.call(partnerId, stream);
    
    call.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on('call', (incomingCall) => {
      incomingCall.answer(stream);
      incomingCall.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
    });

    socket.on('ice-candidate', ({ candidate }) => {
      peer.addIceCandidate(candidate);
    });

    return () => {
      call.close();
      socket.off('ice-candidate');
    };
  }, [peer, socket, partnerId, stream]);

  return (
    <Box sx={{ width: '100%' }}>
      {isSearching && (
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 1 }}>
            Finding a partner...
          </Typography>
        </Box>
      )}

      <Grid container spacing={2} justifyContent="center">
        <Grid item xs={12} md={6}>
          <Box
            sx={{
              width: '100%',
              position: 'relative',
              paddingTop: '56.25%', // 16:9 aspect ratio
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '8px',
              }}
            />
          </Box>
          <Typography variant="subtitle1" align="center" sx={{ mt: 1 }}>
            You
          </Typography>
        </Grid>

        {partnerId && (
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                width: '100%',
                position: 'relative',
                paddingTop: '56.25%',
              }}
            >
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '8px',
                }}
              />
            </Box>
            <Typography variant="subtitle1" align="center" sx={{ mt: 1 }}>
              Partner
            </Typography>
          </Grid>
        )}
      </Grid>

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Button
          variant="contained"
          color="error"
          onClick={onStopCall}
          size="large"
          sx={{
            px: 4,
            py: 1.5,
            fontSize: '1.1rem',
          }}
        >
          End Chat
        </Button>
      </Box>
    </Box>
  );
};

export default VideoCall;
