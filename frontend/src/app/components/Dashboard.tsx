import { Globe, Activity, Zap } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { DashboardRoomCard } from './DashboardRoomCard';
import { useState } from 'react';

interface DashboardProps {
  selectedRoom?: string;
  onBackToHome?: () => void;
  onEnterRoom?: (roomName: string) => void;
  onSignInClick?: () => void;
}

export function Dashboard({ selectedRoom, onBackToHome, onEnterRoom, onSignInClick }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden flex">
      {/* Background Nebula Glows */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
      <div className="absolute top-40 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-purple-700/15 rounded-full blur-[110px]" />

      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onBackToHome={onBackToHome} />

      {/* Main Content */}
      <div className="flex-1 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Welcome back, Speaker. Ready to visualize?
            </h1>
            <p className="text-gray-400 text-sm">
              Welcome back, Speaker. Ready to visualize?
            </p>
          </div>
          <button 
            onClick={onSignInClick}
            className="px-6 py-2 rounded-full border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#00FFFF]/10 transition-all duration-300"
          >
            Sign In
          </button>
        </header>

        {/* Room Cards Container */}
        <div className="px-8 py-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl">
            {/* General AI Room Card */}
            <DashboardRoomCard
              icon={<Globe className="w-16 h-16" />}
              title="General AI Room"
              subtitle="Perfect for lectures, storytelling, and brainstorm brainstorming."
              features={[
                'Real-time Web Search',
                'Medical Reference Access',
              ]}
              accentColor="cyan"
              isSelected={selectedRoom === 'general'}
              onEnterRoom={() => onEnterRoom?.('General AI Room')}
            />

            {/* Mastered Doctor Room Card */}
            <DashboardRoomCard
              icon={<Activity className="w-16 h-16" />}
              title="Mastered Doctor"
              subtitle="Specialized anatomical visualization with smart zoom."
              features={[
                'Smart Anatomical Zoom',
                'Medical Reference Access',
              ]}
              accentColor="purple"
              isSelected={selectedRoom === 'doctor'}
              onEnterRoom={() => onEnterRoom?.('Mastered Doctor')}
            />

            {/* RAG · Apify Room Card */}
            <DashboardRoomCard
              icon={<Zap className="w-16 h-16" />}
              title="RAG · Apify Room"
              subtitle="Pre-fetch topics before class. Local images + datawarehouse. Instant display."
              features={[
                'Local Image Database',
                'Pre-fetch Before Class',
              ]}
              accentColor="green"
              isSelected={selectedRoom === 'rag'}
              onEnterRoom={() => onEnterRoom?.('RAG · Apify Room')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}