import { Box, Button, Container, Typography, Paper } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';

interface HomeProps {
  onStartChat: () => void;
}

const Home = ({ onStartChat }: HomeProps) => {
  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 8,
          textAlign: 'center',
        }}
      >
        <Typography 
          variant="h1" 
          component="h1" 
          sx={{ 
            fontSize: { xs: '3rem', md: '4.5rem' },
            fontWeight: 'bold',
            mb: 2,
            background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
            backgroundClip: 'text',
            textFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          OmioVibe
        </Typography>
        
        <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
          Talk to strangers and make new friends instantly
        </Typography>

        <Paper 
          elevation={3}
          sx={{
            p: 4,
            mb: 4,
            maxWidth: 600,
            width: '100%',
            backgroundColor: 'background.paper',
          }}
        >
          <Typography variant="h6" gutterBottom>
            By clicking "Start Video Chat", you agree to our Terms of Service.
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            You must be 18+ to use this service. Be respectful to others and follow our community guidelines.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<VideocamIcon />}
            onClick={onStartChat}
            sx={{
              py: 2,
              px: 4,
              fontSize: '1.2rem',
              background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #FE6B8B 20%, #FF8E53 80%)',
              },
            }}
          >
            Start Video Chat
          </Button>
        </Paper>

        <Box sx={{ maxWidth: 600, width: '100%' }}>
          <Typography variant="h6" gutterBottom>
            Features:
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            • Instant video chat with people worldwide
            • No registration required
            • Free to use
            • Safe and moderated
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Home; 