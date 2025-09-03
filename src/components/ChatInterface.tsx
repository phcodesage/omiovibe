import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Wifi, WifiOff } from 'lucide-react';

interface Message {
  id: string;
  message: string;
  sender: 'you' | 'stranger';
  timestamp: Date;
}

interface ChatInterfaceProps {
  socket: any;
  isConnected: boolean;
}

export default function ChatInterface({ socket, isConnected }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatStatus, setChatStatus] = useState<'idle' | 'waiting' | 'connected' | 'disconnected'>('idle');
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    // Socket event listeners
    socket.on('waiting', () => {
      setChatStatus('waiting');
      setMessages([]);
    });

    socket.on('chat-found', (data: { roomId: string; stranger: string }) => {
      setChatStatus('connected');
      setCurrentRoom(data.roomId);
      setMessages([]);
      addSystemMessage('Connected to a stranger! Say hello.');
    });

    socket.on('new-message', (data: Message) => {
      setMessages(prev => [...prev, {
        ...data,
        timestamp: new Date(data.timestamp)
      }]);
    });

    socket.on('stranger-typing', (isTyping: boolean) => {
      setStrangerTyping(isTyping);
    });

    socket.on('stranger-disconnected', () => {
      setChatStatus('disconnected');
      addSystemMessage('Stranger has disconnected.');
      setStrangerTyping(false);
    });

    socket.on('error', (error: { message: string }) => {
      addSystemMessage(`Error: ${error.message}`);
    });

    return () => {
      socket.off('waiting');
      socket.off('chat-found');
      socket.off('new-message');
      socket.off('stranger-typing');
      socket.off('stranger-disconnected');
      socket.off('error');
    };
  }, [socket]);

  const addSystemMessage = (text: string) => {
    const systemMessage: Message = {
      id: Date.now().toString(),
      message: text,
      sender: 'you',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const startChat = () => {
    if (socket && isConnected) {
      socket.emit('find-chat');
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newMessage.trim() && socket && chatStatus === 'connected') {
      socket.emit('send-message', { message: newMessage.trim() });
      setNewMessage('');
      
      // Stop typing indicator
      socket.emit('typing', false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (socket && chatStatus === 'connected') {
      // Send typing indicator
      socket.emit('typing', true);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 1 second of no input
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', false);
      }, 1000);
    }
  };

  const disconnectChat = () => {
    if (socket) {
      socket.emit('disconnect-chat');
      setChatStatus('idle');
      setCurrentRoom(null);
      setStrangerTyping(false);
      setMessages([]);
    }
  };

  const newChat = () => {
    disconnectChat();
    setTimeout(() => {
      startChat();
    }, 500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              chatStatus === 'connected' ? 'bg-green-900 text-green-300' :
              chatStatus === 'waiting' ? 'bg-yellow-900 text-yellow-300' :
              chatStatus === 'disconnected' ? 'bg-red-900 text-red-300' :
              'bg-gray-700 text-gray-300'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>
                {chatStatus === 'connected' ? 'Connected' :
                 chatStatus === 'waiting' ? 'Finding stranger...' :
                 chatStatus === 'disconnected' ? 'Disconnected' :
                 'Ready to chat'}
              </span>
            </div>
            {chatStatus === 'connected' && (
              <div className="flex items-center gap-1 text-gray-400 text-sm">
                <Users className="w-4 h-4" />
                <span>You and Stranger</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {chatStatus === 'idle' && (
              <button
                onClick={startChat}
                disabled={!isConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Start Chat
              </button>
            )}
            
            {(chatStatus === 'connected' || chatStatus === 'disconnected') && (
              <div className="flex gap-2">
                <button
                  onClick={newChat}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  New Chat
                </button>
                {chatStatus === 'connected' && (
                  <button
                    onClick={disconnectChat}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && chatStatus === 'idle' && (
          <div className="text-center text-gray-400 mt-8">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-2">Welcome to Anonymous Chat</h3>
              <p className="text-sm text-gray-300 mb-4">
                Connect with random strangers from around the world. Click "Start Chat" to begin.
              </p>
              <div className="text-xs text-gray-400">
                • Be respectful and kind<br/>
                • No personal information sharing<br/>
                • Report inappropriate behavior
              </div>
            </div>
          </div>
        )}

        {chatStatus === 'waiting' && (
          <div className="text-center text-yellow-400 mt-8">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
              <div className="animate-spin w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="font-medium">Looking for someone to chat with...</p>
              <p className="text-sm text-gray-400 mt-2">This may take a moment</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'you' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.sender === 'you'
                  ? 'bg-blue-600 text-white'
                  : msg.message.includes('Connected') || msg.message.includes('disconnected') || msg.message.includes('Error')
                  ? 'bg-gray-700 text-gray-300 text-center'
                  : 'bg-gray-700 text-white'
              }`}
            >
              <p className="text-sm">{msg.message}</p>
              <p className="text-xs opacity-70 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {strangerTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-gray-300 px-4 py-2 rounded-lg animate-pulse">
              <div className="flex items-center gap-1">
                <span className="text-sm">Stranger is typing</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {chatStatus === 'connected' && (
        <div className="border-t border-gray-700 p-4">
          <form onSubmit={sendMessage} className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={chatStatus !== 'connected'}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || chatStatus !== 'connected'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}