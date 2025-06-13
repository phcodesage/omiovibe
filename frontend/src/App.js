import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [showUsernameInput, setShowUsernameInput] = useState(true);

  useEffect(() => {
    socket.on('matched', () => {
      setConnected(true);
      setMessages([{text: "🔗 Connected to a stranger. Say hi!", isSystem: true}]);
    });

    socket.on('chat_message', (data) => {
      setMessages(prev => [...prev, {text: data.text, username: data.username, isIncoming: true}]);
    });

    socket.on('partner_disconnected', () => {
      setConnected(false);
      setMessages(prev => [...prev, {text: "❌ Stranger disconnected.", isSystem: true}]);
    });

    return () => socket.disconnect();
  }, []);

  const handleSetUsername = () => {
    if (username.trim()) {
      socket.emit('set_username', { username: username.trim() });
      setShowUsernameInput(false);
      socket.emit('join');
    }
  };

  const sendMessage = () => {
    if (input.trim()) {
      const message = input.trim();
      socket.emit('chat_message', { text: message });
      setMessages(prev => [...prev, {text: message, username: 'You', isIncoming: false}]);
      setInput("");
    }
  };

  const renderMessage = (msg, index) => {
    if (msg.isSystem) {
      return <div key={index} style={{ textAlign: 'center', color: '#666' }}>{msg.text}</div>;
    }
    
    const isYou = !msg.isIncoming;
    const displayName = isYou ? 'You' : (msg.username || 'Stranger');
    
    return (
      <div 
        key={index} 
        style={{
          textAlign: isYou ? 'right' : 'left',
          margin: '5px 0',
          color: isYou ? '#007bff' : '#28a745'
        }}
      >
        <div style={{ fontWeight: 'bold' }}>{displayName}</div>
        <div>{msg.text}</div>
      </div>
    );
  };

  if (showUsernameInput) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2>Enter Your Username</h2>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
          placeholder="Enter your username"
          style={{ marginRight: '10px' }}
        />
        <button onClick={handleSetUsername}>Start Chatting</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h2>Chat with a Stranger</h2>
      <div style={{ 
        border: "1px solid #ccc", 
        padding: 10, 
        height: 400, 
        overflowY: 'auto', 
        marginBottom: 10,
        borderRadius: '5px',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map((msg, i) => renderMessage(msg, i))}
      </div>
      {connected ? (
        <div style={{ display: 'flex' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            style={{ 
              flex: 1, 
              padding: '10px',
              borderRadius: '5px',
              border: '1px solid #ccc',
              marginRight: '10px'
            }}
          />
          <button 
            onClick={sendMessage}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Send
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#666' }}>
          Waiting to connect with a stranger...
        </div>
      )}
    </div>
  );
}

export default App;
