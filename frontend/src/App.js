import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

const peerConnectionConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

function App() {
    // Auth State
    const [authState, setAuthState] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loggedInUser, setLoggedInUser] = useState(null);

    // Chat & App State
    const [chatState, setChatState] = useState('idle'); // idle, waiting, in_chat
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [partnerUsername, setPartnerUsername] = useState('');

    // Video & WebRTC State
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const peerConnectionRef = useRef(null);
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();

    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    useEffect(() => {
        if (!loggedInUser) return;

        const createPeerConnection = () => {
            const pc = new RTCPeerConnection(peerConnectionConfig);

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice-candidate', { candidate: event.candidate });
                }
            };

            pc.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
            };

            if (localStream) {
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
            }

            peerConnectionRef.current = pc;
        };

        const handleMatched = async ({ partner_username, is_initiator }) => {
            setPartnerUsername(partner_username);
            setChatState('in_chat');
            createPeerConnection();

            if (is_initiator) {
                const offer = await peerConnectionRef.current.createOffer();
                await peerConnectionRef.current.setLocalDescription(offer);
                socket.emit('offer', { offer });
            }
        };

        const handleOffer = async ({ offer }) => {
            if (!peerConnectionRef.current) createPeerConnection();
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);
            socket.emit('answer', { answer });
        };

        const handleAnswer = async ({ answer }) => {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        };

        const handleIceCandidate = async ({ candidate }) => {
            try {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        };

        const cleanupConnection = () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            setRemoteStream(null);
            setPartnerUsername('');
            setMessages([]);
            setChatState('idle');
        };

        socket.on('matched', handleMatched);
        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('partner_disconnected', cleanupConnection);
        socket.on('partner_skipped', cleanupConnection);
        socket.on('stopped_chat', cleanupConnection);
        socket.on('chat_message', (data) => {
            setMessages(prev => [...prev, { text: data.text, username: data.username, isIncoming: true }]);
        });

        return () => {
            socket.off('matched');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('partner_disconnected');
            socket.off('partner_skipped');
            socket.off('stopped_chat');
            socket.off('chat_message');
            cleanupConnection();
        };

    }, [loggedInUser, localStream]);

    const startLocalVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (err) {
            console.error("Error accessing media devices.", err);
            setError("Camera access is required to chat. Please allow access and refresh the page.");
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        let endpoint = authState;
        let payload = { username, password };

        if (authState === 'forgot_password') {
            payload = { username, new_password: newPassword };
        }

        try {
            const response = await fetch(`${BACKEND_URL}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                if (authState === 'login') {
                    setLoggedInUser(data.username);
                    await startLocalVideo();
                } else {
                    setAuthState('login');
                    alert('Action successful! Please log in.');
                }
            } else {
                setError(data.error || 'An unknown error occurred.');
            }
        } catch (err) {
            setError('Failed to connect to the server.');
        }
    };

    const handleStartSearching = () => {
        setChatState('waiting');
        socket.emit('start_searching', { username: loggedInUser });
    };

    const handleStopOrSkip = (action) => {
        socket.emit(action);
    };

    const sendMessage = () => {
        if (messageInput.trim()) {
            const text = messageInput.trim();
            socket.emit('chat_message', { text });
            setMessages(prev => [...prev, { text, username: 'You', isIncoming: false }]);
            setMessageInput('');
        }
    };

    const renderAuthForm = () => (
        <div className="flex flex-col items-center justify-center h-screen text-center bg-gray-100">
            <div className="w-full max-w-md p-10 bg-white rounded-lg shadow-lg">
                <h2 className="mt-0 mb-5 text-2xl font-bold capitalize">{authState.replace('_', ' ')}</h2>
                <form onSubmit={handleAuth}>
                    <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full p-3 mb-4 text-base border border-gray-300 rounded-md" />
                    {authState !== 'forgot_password' && (
                        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 mb-4 text-base border border-gray-300 rounded-md" />
                    )}
                    {authState === 'forgot_password' && (
                        <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full p-3 mb-4 text-base border border-gray-300 rounded-md" />
                    )}
                    <button type="submit" className="w-full p-3 text-base text-white bg-blue-500 border-none rounded-md cursor-pointer hover:bg-blue-700">{authState}</button>
                    {error && <p className="mt-3 text-red-600">{error}</p>}
                </form>
                <p className="mt-5">
                    {authState === 'login' ? (
                        <>
                            No account? <button onClick={() => setAuthState('register')} className="p-0 text-base text-blue-500 bg-transparent border-none cursor-pointer">Register</button> | <button onClick={() => setAuthState('forgot_password')} className="p-0 text-base text-blue-500 bg-transparent border-none cursor-pointer">Forgot Password?</button>
                        </>
                    ) : (
                        <>
                            Already have an account? <button onClick={() => setAuthState('login')} className="p-0 text-base text-blue-500 bg-transparent border-none cursor-pointer">Login</button>
                        </>
                    )}
                </p>
            </div>
        </div>
    );

    const renderWelcomeScreen = () => (
        <div className="flex flex-col items-center justify-center h-screen text-center bg-gray-100">
            <h1 className="mb-5 text-3xl font-bold">Ready to Chat, {loggedInUser}?</h1>
            <div className="w-full max-w-xl mb-5 overflow-hidden rounded-lg shadow-lg">
                <video ref={localVideoRef} autoPlay muted playsInline className="block w-full"></video>
            </div>
            {error && <p className="text-red-600">{error}</p>}
            <button onClick={handleStartSearching} disabled={!localStream || chatState === 'waiting'} className="px-6 py-3 text-lg text-white bg-green-500 border-none rounded-md cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed hover:enabled:bg-green-600">
                {chatState === 'waiting' ? 'Searching...' : 'Start Searching'}
            </button>
        </div>
    );

    const renderChat = () => (
        <div className="flex w-screen h-screen overflow-hidden">
            <div className="relative flex-grow bg-black">
                <video ref={remoteVideoRef} autoPlay playsInline className="object-cover w-full h-full"></video>
                <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-5 right-5 w-1/4 max-w-xs border-2 border-white rounded-lg shadow-md"></video>
            </div>
            <div className="flex flex-col flex-shrink-0 w-96 bg-white border-l border-gray-300">
                <div className="flex flex-col flex-grow p-4 overflow-y-auto">
                    {messages.map((msg, i) => (
                        <div key={i} className={`max-w-xs p-3 mb-3 rounded-2xl break-words ${msg.isIncoming ? 'bg-gray-200 self-start' : 'bg-blue-500 text-white self-end'}`}>
                            <strong className="block mb-1 text-sm opacity-80">{msg.username}</strong>
                            {msg.text}
                        </div>
                    ))}
                </div>
                <div className="flex p-3 border-t border-gray-300">
                    <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        className="flex-grow px-4 py-2 mr-3 text-base border border-gray-300 rounded-full"
                    />
                    <button onClick={sendMessage} className="px-5 py-2 text-white bg-blue-500 border-none rounded-full cursor-pointer hover:bg-blue-600">Send</button>
                </div>
                <div className="flex gap-3 p-3 border-t border-gray-300">
                    <button onClick={() => handleStopOrSkip('stop_chat')} className="flex-grow p-2 text-base text-white bg-red-500 border border-red-500 rounded-md cursor-pointer hover:bg-red-600">Stop</button>
                    <button onClick={() => handleStopOrSkip('skip_chat')} className="flex-grow p-2 text-base text-gray-800 bg-yellow-400 border border-yellow-400 rounded-md cursor-pointer hover:bg-yellow-500">Skip</button>
                </div>
            </div>
        </div>
    );

    if (!loggedInUser) {
        return renderAuthForm();
    } else if (chatState === 'in_chat') {
        return renderChat();
    } else {
        return renderWelcomeScreen(); // Covers 'idle' and 'waiting'
    }
}

export default App;
