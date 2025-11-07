import React, { useState } from 'react';
import Chat from './components/Chat';
import VoiceChat from './components/VoiceChat';
import ImageGenerator from './components/ImageGenerator';
import { ChatIcon, ImageIcon, MicrophoneIcon, OrbIcon } from './components/icons';

type Tab = 'chat' | 'voice' | 'image';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('voice');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return <Chat />;
      case 'voice':
        return <VoiceChat />;
      case 'image':
        return <ImageGenerator />;
      default:
        return <VoiceChat />;
    }
  };

  const TabButton: React.FC<{ tabName: Tab; label: string; icon: React.ReactNode }> = ({ tabName, label, icon }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition-all duration-300 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        activeTab === tabName
          ? 'text-white'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {activeTab === tabName && (
        <div className="absolute inset-0 bg-blue-600/50 rounded-lg" style={{
            boxShadow: '0 0 10px var(--primary-glow-color), inset 0 0 5px var(--primary-glow-color)',
            animation: 'fade-in 0.3s'
        }}></div>
      )}
      <span className="relative z-10">{icon}</span>
      <span className="hidden sm:inline relative z-10">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen font-sans bg-transparent text-slate-300">
      <header className="absolute top-0 left-0 right-0 z-20 p-4">
        <div 
            className="container mx-auto flex justify-between items-center px-4 sm:px-6 py-2 rounded-xl"
            style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 0 20px rgba(0,0,0,0.2)'
            }}
        >
          <div className="flex items-center gap-3">
            <OrbIcon isAnimated={false} />
            <h1 className="text-xl sm:text-2xl font-bold" style={{textShadow: '0 0 5px var(--primary-glow-color)'}}>
                <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Massive Bio</span>
                <span className="text-slate-400"> AI Navigator</span>
            </h1>
          </div>
          <div className="flex items-center space-x-1 p-1 rounded-xl" style={{
              background: 'rgba(2, 6, 23, 0.5)', /* slate-950/50 */
              border: '1px solid var(--glass-border)'
          }}>
             <TabButton tabName="chat" label="Chat" icon={<ChatIcon />} />
             <TabButton tabName="voice" label="Voice" icon={<MicrophoneIcon />} />
             <TabButton tabName="image" label="Image" icon={<ImageIcon />} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden pt-24">
        {renderTabContent()}
      </main>
      
    </div>
  );
};

export default App;
