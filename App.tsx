import React, { useState } from 'react';
import Chat from './components/Chat';
import VoiceChat from './components/VoiceChat';
import ImageGenerator from './components/ImageGenerator';
import { ChatIcon, ImageIcon, MicrophoneIcon } from './components/icons';

type Tab = 'chat' | 'voice' | 'image';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return <Chat />;
      case 'voice':
        return <VoiceChat />;
      case 'image':
        return <ImageGenerator />;
      default:
        return <Chat />;
    }
  };

  const TabButton: React.FC<{ tabName: Tab; label: string; icon: React.ReactNode }> = ({ tabName, label, icon }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-all duration-200 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        activeTab === tabName
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen font-sans bg-slate-950 text-slate-300">
      <header className="flex-shrink-0 sticky top-0 z-10 bg-slate-900/70 backdrop-blur-md border-b border-slate-700/50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Massive Bio</span>
            <span className="text-slate-400"> AI Navigator</span>
          </h1>
          <div className="flex items-center space-x-1 p-1 bg-slate-800/50 rounded-xl">
             <TabButton tabName="chat" label="Chat" icon={<ChatIcon />} />
             <TabButton tabName="voice" label="Voice" icon={<MicrophoneIcon />} />
             <TabButton tabName="image" label="Image" icon={<ImageIcon />} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {renderTabContent()}
      </main>
      
      <footer className="flex-shrink-0 text-center py-2 text-xs text-slate-500 bg-slate-900/70 border-t border-slate-700/50">
        Powered by Massive Bio
      </footer>
    </div>
  );
};

export default App;