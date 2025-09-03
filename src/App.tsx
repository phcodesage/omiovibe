import ChatInterface from './components/ChatInterface';
import { useSocket } from './hooks/useSocket';
import { MessageCircle } from 'lucide-react';

function App() {
  const serverUrl = import.meta.env.VITE_SERVER_URL
  const { socket, isConnected } = useSocket(serverUrl);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Anonymous Chat
              </h1>
              <p className="text-sm text-gray-400">Connect with strangers worldwide</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto h-[calc(100vh-80px)]">
        <div className="h-full bg-gray-800 shadow-xl border border-gray-700">
          {socket && (
            <ChatInterface 
              socket={socket} 
              isConnected={isConnected}
            />
          )}
          
          {!socket && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Connecting to server...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-4">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <p className="text-center text-xs text-gray-400">
            Be respectful and follow community guidelines. Report inappropriate behavior.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;