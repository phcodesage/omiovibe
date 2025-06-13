import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

const socket = io('http://localhost:5000');

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [partnerUsername, setPartnerUsername] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [status, setStatus] = useState('prompt_username'); // 'prompt_username', 'idle', 'waiting', 'in_chat'
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onUsernameSet = () => setStatus('idle');
    const onWaiting = () => {
      setMessages(prev => [...prev, {text: "🔍 Looking for someone to chat with...", isSystem: true}]);
      setStatus('waiting');
      setPartnerUsername('');
    };
    const onMatched = (data) => {
      setMessages([{text: `🔗 Connected to ${data.partner_username || 'a stranger'}. Say hi!`, isSystem: true}]);
      setPartnerUsername(data.partner_username || 'Stranger');
      setStatus('in_chat');
    };
    const onStoppedChat = () => {
      setMessages(prev => [...prev, {text: "🛑 You have stopped the chat.", isSystem: true}]);
      setStatus('idle');
      setPartnerUsername('');
    };
    const onPartnerDisconnected = () => {
      setMessages(prev => [...prev, {text: "❌ Stranger has disconnected.", isSystem: true}]);
      setStatus('idle');
      setPartnerUsername('');
    };
    const onPartnerSkipped = () => {
      setMessages(prev => [...prev, {text: "⏩ Your partner skipped. Finding a new chat...", isSystem: true}]);
      // Server will send 'waiting' event next
    };
    const onChatMessage = (data) => {
        setMessages(prev => [...prev, {text: data.text, username: data.username, isIncoming: true}]);
        setTypingUser('');
    };
    const onUserTyping = (data) => setTypingUser(data.username || 'Stranger');
    const onUserStoppedTyping = () => setTypingUser('');

    socket.on('username_set', onUsernameSet);
    socket.on('waiting', onWaiting);
    socket.on('matched', onMatched);
    socket.on('stopped_chat', onStoppedChat);
    socket.on('partner_disconnected', onPartnerDisconnected);
    socket.on('partner_skipped', onPartnerSkipped);
    socket.on('chat_message', onChatMessage);
    socket.on('user_typing', onUserTyping);
    socket.on('user_stopped_typing', onUserStoppedTyping);

    return () => {
      socket.off('username_set', onUsernameSet);
      socket.off('waiting', onWaiting);
      socket.off('matched', onMatched);
      socket.off('stopped_chat', onStoppedChat);
      socket.off('partner_disconnected', onPartnerDisconnected);
      socket.off('partner_skipped', onPartnerSkipped);
      socket.off('chat_message', onChatMessage);
      socket.off('user_typing', onUserTyping);
      socket.off('user_stopped_typing', onUserStoppedTyping);
    };
  }, []);

  const handleSetUsername = () => {
    if (username.trim()) {
      socket.emit('set_username', { username: username.trim() });
    }
  };

  const handleStartSearching = () => socket.emit('start_searching');
  const handleStopChat = () => socket.emit('stop_chat');
  const handleSkipChat = () => socket.emit('skip_chat');

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (!isTyping && value.trim() !== '') {
      socket.emit('typing');
      setIsTyping(true);
    } else if (value === '' && isTyping) {
      socket.emit('stop_typing');
      setIsTyping(false);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        socket.emit('stop_typing');
        setIsTyping(false);
      }
    }, 2000);
  };

  const sendMessage = () => {
    if (input.trim()) {
      const message = input.trim();
      socket.emit('chat_message', { text: message });
      setMessages(prev => [...prev, {text: message, username: 'You', isIncoming: false}]);
      setInput("");
      socket.emit('stop_typing');
      setIsTyping(false);
    }
  };

  const toggleEmojiPicker = () => setShowEmojiPicker(!showEmojiPicker);

  const onEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPosition);
    const textAfterCursor = input.substring(cursorPosition);
    setInput(textBeforeCursor + emoji + textAfterCursor);
    setTimeout(() => {
      const newPosition = cursorPosition + emoji.length;
      inputRef.current.setSelectionRange(newPosition, newPosition);
    }, 0);
    setShowEmojiPicker(false);
  };

  const renderMessage = (msg, index) => {
    if (msg.isSystem) {
      return (
        <div key={index} style={{textAlign: 'center', color: '#666', margin: '10px 0', padding: '5px', fontSize: '0.9em'}}>
          {msg.text}
        </div>
      );
    }
    const isYou = !msg.isIncoming;
    const displayName = isYou ? 'You' : (msg.username || 'Stranger');
    return (
      <div key={index} style={{margin: '10px', textAlign: isYou ? 'right' : 'left'}}>
        <div style={{display: 'inline-block', maxWidth: '70%', padding: '8px 12px', borderRadius: isYou ? '18px 18px 0 18px' : '18px 18px 18px 0', backgroundColor: isYou ? '#0084ff' : '#e9e9eb', color: isYou ? 'white' : 'black', wordWrap: 'break-word'}}>
          <div style={{fontSize: '0.8em', opacity: 0.8, marginBottom: '2px'}}>{displayName}</div>
          <div>{msg.text}</div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (status) {
      case 'prompt_username':
        return (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f5f5f5', textAlign: 'center', padding: '20px'}}>
            <h1 style={{color: '#333', marginBottom: '30px'}}>Omegle Clone</h1>
            <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px'}}>
              <h2 style={{marginBottom: '20px', color: '#333'}}>Enter Your Username</h2>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()} placeholder="Choose a username" style={{width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '16px'}} />
              <button onClick={handleSetUsername} style={{width: '100%', padding: '12px', backgroundColor: '#0084ff', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer', transition: 'background-color 0.2s'}}>Start Chatting</button>
            </div>
          </div>
        );
      case 'idle':
        return (
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f5f5f5', textAlign: 'center', padding: '20px'}}>
                <h1 style={{color: '#333', marginBottom: '30px'}}>Ready to Chat?</h1>
                <button onClick={handleStartSearching} style={{padding: '15px 30px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer'}}>Start</button>
            </div>
        );
      case 'waiting':
      case 'in_chat':
        return (
          <div style={{display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f5f5f5'}}>
            <div style={{backgroundColor: '#0084ff', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
              <div style={{fontWeight: 'bold', fontSize: '18px'}}>
                {status === 'in_chat' ? `Chatting with ${partnerUsername}` : 'Searching...'}
              </div>
              <div style={{display: 'flex', gap: '10px'}}>
                {status === 'in_chat' && <button onClick={handleSkipChat} style={{backgroundColor: 'transparent', border: '1px solid white', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>⏭️ Skip</button>}
                <button onClick={handleStopChat} style={{backgroundColor: '#ff4444', border: '1px solid #ff4444', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'}}>⏹️ Stop</button>
              </div>
            </div>
            <div style={{flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#e5ddd5'}}>
              {messages.map((msg, i) => renderMessage(msg, i))}
              {typingUser && <div style={{margin: '10px', padding: '8px 12px', backgroundColor: '#fff', borderRadius: '18px', display: 'inline-block', boxShadow: '0 1px 2px rgba(0,0,0,0.1)'}}>{typingUser} is typing...</div>}
              <div ref={messagesEndRef} />
            </div>
            {status === 'in_chat' && (
              <div style={{backgroundColor: '#f5f5f5', padding: '10px', borderTop: '1px solid #ddd', position: 'relative'}}>
                {showEmojiPicker && <div style={{position: 'absolute', bottom: '100%', right: '10px', marginBottom: '10px', zIndex: 10}}><EmojiPicker onEmojiClick={onEmojiClick} width={300} height={350} /></div>}
                <div style={{display: 'flex', alignItems: 'center', backgroundColor: 'white', borderRadius: '20px', padding: '5px 15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
                  <button onClick={toggleEmojiPicker} style={{background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', padding: '5px', marginRight: '5px', color: '#666'}}>😊</button>
                  <input ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." style={{flex: 1, border: 'none', outline: 'none', padding: '10px 0', fontSize: '1em', backgroundColor: 'transparent'}} />
                  <button onClick={sendMessage} disabled={!input.trim()} style={{background: 'none', border: 'none', fontSize: '1.2em', cursor: input.trim() ? 'pointer' : 'default', padding: '5px 0 5px 10px', color: input.trim() ? '#0084ff' : '#ccc', transition: 'color 0.2s'}}>➤</button>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <div>Loading...</div>;
    }
  };

  return renderContent();
}

export default App;
