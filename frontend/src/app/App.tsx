import { Globe, Activity, Mic, Zap } from 'lucide-react';
import { motion } from 'motion/react';
const ogLogoImage = "/assets/logo.png";
import { RoomCard } from './components/RoomCard';
import { Dashboard } from './components/Dashboard';
import RoomInterface from './components/RoomInterface';
import RagApifyRoomInterface from './components/RagApifyRoomInteraface';
import { SignIn } from './components/SignIn';
import { useState } from 'react';

// ─────────────────────────────────────────────────────
// NAVIGATION FLOW:
//   Home → click any room card     → Dashboard
//   Dashboard → click Enter Room   → Workspace (room or rag-room)
//   Workspace → Exit / ArrowLeft   → Dashboard  ← FIXED (was going to home/browser)
//   Dashboard → Back arrow         → Home
// ─────────────────────────────────────────────────────

export default function App() {
  const [currentView, setCurrentView] = useState<
    'home' | 'dashboard' | 'room' | 'rag-room' | 'signin'
  >('home');
  const [selectedRoom, setSelectedRoom]   = useState<string | undefined>();
  const [activeRoomName, setActiveRoomName] = useState<string>('');

  // Click a room card on home page → Dashboard
  const handleRoomClick = (room: string) => {
    setSelectedRoom(room);
    setCurrentView('dashboard');
  };

  // Click RAG room card on home page → Dashboard with rag selected
  const handleRagRoomClick = () => {
    setSelectedRoom('rag');
    setCurrentView('dashboard');
  };

  // Dashboard "Enter Room" button clicked
  const handleEnterRoom = (roomName: string) => {
    setActiveRoomName(roomName);
    if (roomName === 'RAG · Apify Room' || roomName === 'rag') {
      setCurrentView('rag-room');
    } else {
      setCurrentView('room');
    }
  };

  // Exit from any workspace → back to Dashboard (NOT home, NOT browser)
  const handleExitRoom = () => {
    setCurrentView('dashboard');
  };

  // Dashboard back arrow → Home
  const handleBackToHome = () => {
    setCurrentView('home');
  };

  const handleSignInClick  = () => setCurrentView('signin');
  const handleCloseSignIn  = () => setCurrentView('home');

  // ── Route rendering ──

  if (currentView === 'signin') {
    return <SignIn onClose={handleCloseSignIn} />;
  }

  if (currentView === 'room') {
    // Pass onExit so RoomInterface can navigate back
    return <RoomInterface/>;
  }

  if (currentView === 'rag-room') {
    return <RagApifyRoomInterface onExit={handleExitRoom} />;
  }

  if (currentView === 'dashboard') {
    return (
      <Dashboard
        selectedRoom={selectedRoom}
        onBackToHome={handleBackToHome}
        onEnterRoom={handleEnterRoom}
        onSignInClick={handleSignInClick}
      />
    );
  }

  // ── Home page ──
  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
      <div className="absolute top-40 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-purple-700/15 rounded-full blur-[110px]" />

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <img src={ogLogoImage} alt="OpticGlide Logo" className="h-12" />
        </div>
        <button
          onClick={handleSignInClick}
          className="px-6 py-2 rounded-full border-2 border-[#00FFFF] text-[#00FFFF] hover:bg-[#00FFFF]/10 transition-all duration-300"
        >
          Sign In
        </button>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-8 pt-16 pb-20">
        <h1 className="text-6xl md:text-7xl font-bold text-center mb-6 text-[#00FFFF] drop-shadow-[0_0_30px_rgba(0,255,255,0.8)]">
          Speak. Visualize. Understand.
        </h1>
        <p className="text-gray-300 text-center text-lg md:text-xl max-w-3xl mb-16">
          An AI powered environment that listens to your speech and
          <br />
          manifests real-time visual context from across the web.
        </p>

        <div className="w-full max-w-6xl">
          <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 shadow-[0_8px_32px_0_rgba(0,255,255,0.15)]">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-600/5 pointer-events-none" />

            <div className="relative grid md:grid-cols-3 gap-8">
              <RoomCard
                icon={<Globe className="w-10 h-10" />}
                title="General AI Room"
                description="Perfect for lectures, storytelling, and brainstorming. Visualizes any topic on the fly."
                accentColor="cyan"
                onClick={() => handleRoomClick('general')}
              />
              <RoomCard
                icon={<Activity className="w-10 h-10" />}
                title="Mastered Doctor"
                description="Specialized anatomical visualization with smart zoom for medical education."
                accentColor="purple"
                onClick={() => handleRoomClick('doctor')}
              />
              <div className="relative">
                <div
                  className="absolute -top-3 -right-3 z-20 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: 'rgba(16,185,129,.2)',
                    border: '1px solid rgba(16,185,129,.5)',
                    color: '#10b981',
                    fontFamily: 'monospace',
                    boxShadow: '0 0 14px rgba(16,185,129,.3)',
                  }}
                >
                  NEW
                </div>
                <RoomCard
                  icon={<Zap className="w-10 h-10" />}
                  title="RAG · Apify Room"
                  description="Pre-fetch topics before class. Local images + datawarehouse content. Instant display."
                  accentColor="green"
                  onClick={handleRagRoomClick}
                />
              </div>
            </div>

            <div className="mt-12 text-center text-gray-400 text-sm">
              Speak naturally — OpticGlide visualizes what you're teaching in real time
            </div>
          </div>
        </div>

        <motion.div
          className="mt-20 relative"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 bg-[#00FFFF] rounded-full blur-xl opacity-60" />
          <div className="relative bg-[#00FFFF]/20 backdrop-blur-sm border-2 border-[#00FFFF] rounded-full p-6 hover:bg-[#00FFFF]/30 transition-all duration-300 cursor-pointer">
            <Mic className="w-8 h-8 text-[#00FFFF]" />
          </div>
        </motion.div>
      </main>
    </div>
  );
}
