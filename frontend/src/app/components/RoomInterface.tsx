import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, Settings, Pen, Power, ZoomIn } from 'lucide-react';
import { ConceptNode, AIResponse } from '../../types';
import { TemplateRenderer } from '../../components/TemplateRenderer';
import { ImageDisplay } from '../../components/ImageDisplay';
// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────

interface RoomInterfaceProps {
  onExit?: () => void;
}

interface TranscriptMessage {
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

// Colors assigned to node balls in orbit — cycles through this list
const NODE_COLORS = [
  "#06B6D4", // cyan
  "#8B5CF6", // purple
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
];

// Speech phrases that trigger blackboard (fullscreen image) mode
const BLACKBOARD_TRIGGERS = [
  "show image",
  "show me",
  "let me see",
  "display image",
  "show picture",
  "full screen",
  "fullscreen",
  "zoom in",
];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function RoomInterface({ onExit }: RoomInterfaceProps) {

  // ── Core State ──
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [recognition, setRecognition] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);

  // ── UI / Theme State ──
  const [isDarkMode, setIsDarkMode] = useState(true);              // dark/light toggle (top header)
  const [featuresExpanded, setFeaturesExpanded] = useState(false); // F^ menu open/close
  const [isDrawingMode, setIsDrawingMode] = useState(false);       // Interactive Draw toggle
  const [aiPaused, setAiPaused] = useState(false);                 // Rest AI toggle
  const [modelStatus, setModelStatus] = useState<{status: string; available: string[]; active: string}>({
    status: 'unknown',
    available: [],
    active: ''
  });  // NEW: Model health indicator

  // ── Node / Canvas State ──
  const [nodes, setNodes] = useState<ConceptNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [blackboardMode, setBlackboardMode] = useState(false);     // fullscreen image overlay

  // ── Refs ──
  const websocketRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────
  // DERIVED VALUES
  // ─────────────────────────────────────────────

  // Only nodes that are minimized into orbit balls
  const minimizedNodes = nodes.filter(n => n.status === 'minimized');

  // The currently active (center) node
  const activeNode = nodes.find(n => n.status === 'active');

  // NEW: History for scrollable sidebar (all nodes including active, sorted by timestamp)
  const history = nodes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  // Calculate x/y % position for a minimized node in circular orbit around center
  const calcMinimizedPosition = (index: number, total: number) => {
    const angle = (index * (360 / Math.max(total, 1)) - 90) * (Math.PI / 180);
    // Increase orbit radius so balls sit further from center and don't overlap card
    const rx = 42; // horizontal orbit radius as % of canvas
    const ry = 36; // vertical orbit radius as % of canvas
    return {
      x: 50 + rx * Math.cos(angle),
      y: 50 + ry * Math.sin(angle),
    };
  };

  // Returns true if the speech text contains any blackboard trigger phrase
  const checkBlackboardTrigger = (text: string): boolean => {
    const lower = text.toLowerCase();
    return BLACKBOARD_TRIGGERS.some((trigger) => lower.includes(trigger));
  };

  // ─────────────────────────────────────────────
  // AUTO-SCROLL TRANSCRIPT
  // ─────────────────────────────────────────────

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ─────────────────────────────────────────────
  // WEBSOCKET CONNECTION
  // ─────────────────────────────────────────────

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      setIsConnected(true);
      // Request model info on connect
      ws.send(JSON.stringify({ type: 'get_models' }));
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📦 Received:', data);

      if (data.type === 'visualization') {
        // New concept from AI — update canvas
        handleNewConcept(data);
      } else if (data.type === 'models_info') {
        // NEW: Model health indicator update
        setModelStatus({
          status: data.status,
          available: data.available,
          active: data.active
        });
      } else if (data.type === 'low_confidence') {
        console.log('⚠️ Low confidence:', data.message);
        setAiStatus('idle');
      } else if (data.type === 'error') {
        console.error('❌ Backend error:', data.message);
        setAiStatus('idle');
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket Error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket Closed');
      setIsConnected(false);
    };

    websocketRef.current = ws;
    return () => ws.close();
  }, []);

  // ─────────────────────────────────────────────
  // SPEECH RECOGNITION SETUP
  // ─────────────────────────────────────────────

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-IN'; // Indian English

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t + ' ';
          }
        }

        if (finalTranscript) {
          const textTrim = finalTranscript.trim();
          console.log('🎤 Transcribed:', textTrim);

          // Check if user said blackboard trigger words
          if (checkBlackboardTrigger(textTrim)) {
            setBlackboardMode(true);
          }

          // Add user speech to live transcript panel
          setTranscript(prev => [...prev, {
            type: 'user',
            text: textTrim,
            timestamp: new Date()
          }]);

          // Avoid sending very short/meaningless utterances (e.g., "very") to backend
          const words = textTrim.split(/\s+/).filter(Boolean);
          if (words.length > 1) {
            if (websocketRef.current?.readyState === WebSocket.OPEN) {
              websocketRef.current.send(JSON.stringify({
                type: 'text',
                text: textTrim,
                timestamp: new Date().toISOString()
              }));
            }
          } else {
            console.log('ℹ️ Ignoring short utterance (not sent):', textTrim);
          }
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('Please allow microphone access');
        }
      };

      recognitionInstance.onend = () => {
        console.log('🎤 Recognition ended');
        setIsListening(false);
        setIsRecording(false);
        setAiStatus('idle');
      };

      setRecognition(recognitionInstance);
      console.log('✅ Speech recognition initialized');
    } else {
      console.error('❌ Browser does not support speech recognition');
      alert('Your browser does not support speech recognition. Please use Chrome, Edge, or Safari.');
    }
  }, []);

  // ─────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────

  // Called when AI sends a new concept via WebSocket
  const handleNewConcept = (data: AIResponse) => {
    setAiStatus('processing');

    // Add AI reasoning line to live transcript
    setTranscript(prev => [...prev, {
      type: 'ai',
      text: `OK! The user is explaining ${data.concept} so I need to present ${data.concept} along with specifying part names.`,
      timestamp: new Date()
    }]);

    // Small delay for smooth animation transition
    setTimeout(() => {
      setNodes((prev) => {
        // Normalize concept text for matching
        const incomingConcept = (data.concept || '').toLowerCase().trim();

        // If there is an active node and the new concept is the same, merge it
        const existingIndex = prev.findIndex(n => (n.concept || '').toLowerCase().trim() === incomingConcept && n.status === 'active');
        if (existingIndex !== -1) {
          // Update existing node instead of creating a duplicate
          const updated = prev.map((n, i) => {
            if (i === existingIndex) {
              // Merge facts and update description/media
              const mergedFacts = Array.from(new Set([...(n.key_facts || []), ...(data.key_facts || [])]));
              const media = (data.media_url || data.image_url || data.image_path || '');
              return {
                ...n,
                imageUrl: media || n.imageUrl,
                description: data.description || n.description,
                key_facts: mergedFacts,
                parts: data.parts && data.parts.length ? data.parts : n.parts,
                links: data.links && data.links.length ? data.links : n.links,
                intent: data.intent || n.intent,
                mentionCount: (n.mentionCount || 1) + 1,
                status: 'active' as const,
                position: { x: 50, y: 50 },
              };
            }
            return n;
          });
          setActiveNodeId(updated[existingIndex].id);
          setAiStatus('idle');
          return updated;
        }

        // If there is no active node, create a new one
        if (!prev.some(n => n.status === 'active')) {
          const newNode: ConceptNode = {
            id: `node_${Date.now()}`,
            concept: (data.concept || '').trim(),
            imageUrl: (data.media_url || data.image_url || data.image_path || ''),
            parts: data.parts || [],
            description: data.description || '',
            key_facts: data.key_facts || [],
            links: data.links || [],
            content_weight: data.content_weight || 'medium',
            intent: data.intent,
            timestamp: new Date(),
            status: 'active',
            color: NODE_COLORS[prev.length % NODE_COLORS.length],
            position: { x: 50, y: 50 },
            mentionCount: 1,
          };
          setActiveNodeId(newNode.id);
          setAiStatus('idle');
          return [...prev, newNode];
        }

        // If there is already an active node and the new concept is different, replace it (do NOT move to history automatically)
        // Only one active node at a time, do not minimize automatically
        const filtered = prev.filter(n => n.status !== 'active');
        const newNode: ConceptNode = {
          id: `node_${Date.now()}`,
          concept: (data.concept || '').trim(),
          imageUrl: (data.media_url || data.image_url || data.image_path || ''),
          parts: data.parts || [],
          description: data.description || '',
          key_facts: data.key_facts || [],
          links: data.links || [],
          content_weight: data.content_weight || 'medium',
          intent: data.intent,
          timestamp: new Date(),
          status: 'active',
          color: NODE_COLORS[filtered.length % NODE_COLORS.length],
          position: { x: 50, y: 50 },
          mentionCount: 1,
        };
        setActiveNodeId(newNode.id);
        setAiStatus('idle');
        return [...filtered, newNode];
      });
    }, 300);
  };

  // Start Fresh button — minimize current active node into orbit and clear center
  // Only when Fresh Board is clicked, move current active node to history (minimized)
  const handleStartFresh = () => {
    setNodes((prev) => {
      if (!prev || prev.length === 0) return prev;
      // Find the active node
      const activeIdx = prev.findIndex(n => n.status === 'active');
      if (activeIdx === -1) return prev;
      // Move active node to minimized
      const updated = prev.map((n, i) => {
        if (i === activeIdx) {
          const pos = calcMinimizedPosition(i, prev.length);
          return { ...n, status: 'minimized' as const, position: pos };
        }
        return n;
      });
      setActiveNodeId(null);
      return updated;
    });
  };

  // Called when user clicks a minimized orbit ball to restore it to center
  const restoreNode = (nodeId: string) => {
    setNodes((prev) => {
      let miniCounter = 0;
      return prev.map((n) => {
        if (n.id === nodeId) {
          // This node becomes active again
          return { ...n, status: 'active' as const, position: { x: 50, y: 50 } };
        }
        if (n.status === 'active') {
          // Currently active node gets pushed to orbit
          const pos = calcMinimizedPosition(miniCounter++, prev.length);
          return { ...n, status: 'minimized' as const, position: pos };
        }
        // Re-calculate orbit position for other minimized nodes
        const pos = calcMinimizedPosition(miniCounter++, prev.length);
        return { ...n, position: pos };
      });
    });
    setActiveNodeId(nodeId);
  };

  // Mic button — start/stop speech recognition
  const handleMicClick = () => {
  if (!recognition) {
    alert('Speech recognition not available');
    return;
  }

  if (isRecording) {
    // Stop recording
    try { recognition.stop(); } catch (e) {}
    setIsRecording(false);
    setIsListening(false);
    setAiStatus('idle');
  } else {
    // Start recording — only if not already running
    if (isListening) return; // guard: already started, skip
    try {
      recognition.start();
      setIsRecording(true);
      setIsListening(true);
      setAiStatus('listening');
    } catch (e: any) {
      // Already started error — just update UI state to match reality
      if (e.message?.includes('already started')) {
        setIsRecording(true);
        setIsListening(true);
        setAiStatus('listening');
      } else {
        console.error('Mic error:', e);
      }
    }
  }
};
  // F^ Smart Zoom — focus on active node (extend with zoom animation later)
  const handleSmartZoom = () => {
    if (activeNode) {
      console.log('🔍 Zooming to active node:', activeNode.concept);
      // Future: animate canvas scale around activeNode
    }
  };

  // Exit Room button — close WebSocket and navigate to Dashboard
  const handleExitRoom = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    if (onExit) {
      onExit();
    }
  };

  const handleRestAI = () => {
    setAiPaused(!aiPaused);
    
    if (!aiPaused) {
      // Pausing AI — stop listening
      try { recognition?.stop(); } catch (e) {}
      setIsRecording(false);
      setIsListening(false);
      setAiStatus('idle');
    } else {
      // Resuming AI — restart listening
      if (recognition && !isListening) {
        try {
          recognition.start();
          setIsRecording(true);
          setIsListening(true);
          setAiStatus('listening');
        } catch (e) {
          console.error('Error resuming AI:', e);
        }
      }
    }
  };
  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div
      className="relative w-full h-screen overflow-hidden transition-colors duration-500"
      style={{
        background: isDarkMode
          ? '#0a0a0a'
          : 'linear-gradient(to bottom right, #f9fafb, #dbeafe, #f3e8ff)'
      }}
    >

      {/* ── Ambient background glow blobs (space / morning theme) ── */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        {isDarkMode ? (
          <>
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[150px]" />
            <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-cyan-900/15 rounded-full blur-[120px]" />
          </>
        ) : (
          <>
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-[150px]" />
            <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-purple-400/20 rounded-full blur-[120px]" />
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          TOP HEADER BAR
          Left:  Back arrow + Logo + OpticGlide + Room Name badge
          Right: Dark/Light toggle + Connected status + Exit Room + Settings
      ══════════════════════════════════════════ */}
      <header className="relative z-50 flex items-center justify-between px-6 py-4">

        {/* Left — Back arrow + Logo + Title + Room Badge */}
        <div className="flex items-center gap-3">
          {/* NEW: Back Arrow Button — consistent navigation */}
          <motion.button
            onClick={handleExitRoom}
            className={`p-2 rounded border transition-colors ${
              isDarkMode
                ? 'bg-white/5 hover:bg-white/10 border-white/10'
                : 'bg-gray-200 hover:bg-gray-300 border-gray-300'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Back to Room Selection"
          >
            <ArrowLeft className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`} />
          </motion.button>
          <img src="/assets/logo.png" alt="OG" className="h-10" />
          <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            OpticGlide
          </span>
          <span className={`px-3 py-1 rounded text-sm border ${
            isDarkMode
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
              : 'bg-blue-100 text-blue-700 border-blue-300'
          }`}>
            [Room Name: Mastered Doctor]
          </span>
        </div>

        {/* Right — Controls */}
        <div className="flex items-center gap-3">

          {/* Dark / Light Mode Toggle */}
          <motion.button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded border transition-colors ${
              isDarkMode
                ? 'bg-white/5 hover:bg-white/10 border-white/10'
                : 'bg-gray-200 hover:bg-gray-300 border-gray-300'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </motion.button>

          {/* Connection Status Pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Exit Room Button */}
          <button
            onClick={handleExitRoom}
            className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400
              rounded text-sm border border-red-500/30 transition-colors"
          >
            Exit Room
          </button>

          {/* Settings Gear */}
          <motion.button
            className={`p-2 rounded border transition-colors ${
              isDarkMode
                ? 'bg-white/5 hover:bg-white/10 border-white/10'
                : 'bg-gray-200 hover:bg-gray-300 border-gray-300'
            }`}
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.3 }}
          >
            <Settings className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`} />
          </motion.button>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN WORKSPACE CANVAS
          Layer 1 — SVG dashed connection lines
          Layer 2 — Minimized orbit node balls
          Layer 3 — Active concept via TemplateRenderer
          Layer 4 — Blackboard fullscreen overlay
          Empty state — shown before first concept
      ══════════════════════════════════════════ */}
      <div className="relative w-full h-[calc(100vh-120px)]">

        {/* ── Layer 1: SVG dashed connection lines from orbit balls to center ── */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {minimizedNodes.map((node) => (
            <g key={node.id}>
              <line
                x1={`${node.position.x}%`}
                y1={`${node.position.y}%`}
                x2="50%"
                y2="50%"
                stroke={node.color}
                strokeWidth="1.5"
                strokeDasharray="6,4"
                opacity="0.35"
              />
              {/* Small glow dot at center anchor point */}
              <circle cx="50%" cy="50%" r="3" fill={node.color} opacity="0.2" />
            </g>
          ))}
        </svg>

        {/* ── Layer 2: Minimized orbit node balls ── */}
        {minimizedNodes.map((node) => (
          <motion.div
            key={node.id}
            className="absolute z-5 cursor-pointer group"
            style={{
              left: `${node.position.x}%`,
              top: `${node.position.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.8 }}
            transition={{ type: 'spring', stiffness: 300 }}
            onClick={() => restoreNode(node.id)}
          >
            {/* Colored ball — color is assigned from NODE_COLORS at creation */}
            <motion.div
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2"
              style={{
                background: node.color + '33',        // 20% opacity fill
                borderColor: node.color,
                boxShadow: `0 0 12px ${node.color}55`,
              }}
              layoutId={`ball_${node.id}`}
            >
              {/* First 2 letters of concept name inside ball */}
              <span
                style={{ color: node.color }}
                className="text-xs font-bold select-none"
              >
                {node.concept.slice(0, 2).toUpperCase()}
              </span>
            </motion.div>

            {/* Hover tooltip — full concept name + restore hint */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2
              hidden group-hover:block bg-black/90 text-white text-xs
              px-3 py-1.5 rounded-lg border border-white/20
              whitespace-nowrap z-50 pointer-events-none">
              {node.concept}
              <div className="text-gray-400 text-[10px] mt-0.5">Click to restore</div>
            </div>
          </motion.div>
        ))}

        {/* ── Layer 3: Active concept display ──────────────────────────────── */}
        {/* TemplateRenderer automatically picks:                               */}
        {/*   ShortViewTemplate  → content_weight = "short"  (compact card)    */}
        {/*   MediumViewTemplate → content_weight = "medium" (standard, default)*/}
        {/*   LongViewTemplate   → content_weight = "long"   (deep dive)        */}
        <div className="absolute inset-0 flex items-center justify-center z-10 px-8">
          <AnimatePresence mode="wait">
            {activeNode && (
              <motion.div
                key={activeNode.id}
                className="w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28 }}
              >
                <TemplateRenderer node={activeNode} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Layer 4: Blackboard mode — fullscreen image, hides everything ── */}
        {/* Triggered when user says "show image", "show me", "full screen" etc */}
        <AnimatePresence>
          {blackboardMode && activeNode && (
            <ImageDisplay
              imageUrl={activeNode.imageUrl}
              blackboardMode={true}
              onExitBlackboard={() => setBlackboardMode(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Empty State — shown before first concept arrives ── */}
        {!activeNode && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className={`text-xl ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                {isRecording ? '🎤 Listening...' : 'Click the mic to start'}
              </p>
              <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                Try saying: "Show me the human brain"
              </p>
            </div>
          </div>
        )}

        {/* ── NEW: Scrollable History Sidebar — Left side ── */}
        {history.length > 0 && (
          <div className={`absolute top-20 left-4 max-h-[calc(100vh-200px)] flex flex-col gap-2 pb-4 overflow-y-auto scrollbar-hide z-20`}>
            <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} pl-2`}>
              HISTORY
            </div>
            {history.map((node) => (
              <motion.button
                key={node.id}
                onClick={() => restoreNode(node.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                  node.id === activeNodeId
                    ? `${isDarkMode ? 'bg-cyan-500/30 border border-cyan-500/50 text-cyan-300' : 'bg-cyan-100 border border-cyan-400 text-cyan-900'}`
                    : `${isDarkMode ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300' : 'bg-white/50 hover:bg-white/80 border border-gray-300 text-gray-700'}`
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Colored dot matching node color */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: node.color }}
                />
                {/* Truncated concept name */}
                <span className="truncate max-w-[120px]">{node.concept}</span>
                {/* Mention count badge */}
                {node.mentionCount > 1 && (
                  <span className={`text-[10px] flex-shrink-0 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                    ×{node.mentionCount}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          BOTTOM CONTROL BAR
          Left:   F^ features button + expandable menu (Draw, Rest AI, Smart Zoom)
          Center: Mic button (cyan idle, red when recording, pulsing rings)
      ══════════════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0 h-20 flex items-center justify-center">

        {/* ── F^ Features Button — Bottom Left ── */}
        <div className="absolute left-6 bottom-6">

          {/* Main F^ circular button */}
          <motion.button
            onClick={() => setFeaturesExpanded(!featuresExpanded)}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center
              transition-all backdrop-blur-md ${
              isDarkMode
                ? 'bg-cyan-500/20 border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,255,255,0.4)]'
                : 'bg-cyan-100 border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,200,255,0.3)]'
            } ${featuresExpanded ? 'shadow-[0_0_50px_rgba(0,255,255,0.8)]' : ''}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className={`font-bold text-lg ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>
              F<sup className="text-xs">^</sup>
            </span>
          </motion.button>

          {/* Expandable feature buttons — pop up above F^ when clicked */}
          <AnimatePresence>
            {featuresExpanded && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="absolute bottom-16 left-0 flex flex-col gap-2"
              >

                {/* Interactive Draw — toggle drawing annotations on canvas */}
                <motion.button
                  onClick={() => setIsDrawingMode(!isDrawingMode)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center
                    backdrop-blur-md transition-all ${
                    isDrawingMode
                      ? 'bg-cyan-500 shadow-[0_0_20px_rgba(0,255,255,0.6)]'
                      : isDarkMode
                      ? 'bg-white/10 border border-white/20 hover:bg-white/20'
                      : 'bg-white border border-gray-300 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="Interactive Draw"
                >
                  <Pen className={`w-5 h-5 ${
                    isDrawingMode ? 'text-black' : isDarkMode ? 'text-cyan-400' : 'text-cyan-700'
                  }`} />
                </motion.button>

                {/* Rest AI — pause or resume listening + WebSocket processing */}
                <motion.button
                  onClick={handleRestAI}
                  className={`w-12 h-12 rounded-full flex items-center justify-center
                    backdrop-blur-md transition-all ${
                    aiPaused
                      ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                      : isDarkMode
                      ? 'bg-white/10 border border-white/20 hover:bg-white/20'
                      : 'bg-white border border-gray-300 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title={aiPaused ? 'Resume AI' : 'Pause AI'}
                >
                  <Power className={`w-5 h-5 ${
                    aiPaused ? 'text-white' : isDarkMode ? 'text-gray-400' : 'text-gray-700'
                  }`} />
                </motion.button>

                {/* Smart Zoom — focus view on currently active node */}
                <motion.button
                  onClick={handleSmartZoom}
                  className={`w-12 h-12 rounded-full flex items-center justify-center
                    backdrop-blur-md transition-all ${
                    isDarkMode
                      ? 'bg-white/10 border border-white/20 hover:bg-white/20'
                      : 'bg-white border border-gray-300 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="Smart Zoom to Active Node"
                >
                  <ZoomIn className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`} />
                </motion.button>

                {/* NEW: Model Health — shows model status + available models */}
                <motion.button
                  className={`w-12 h-12 rounded-full flex items-center justify-center
                    backdrop-blur-md transition-all relative group ${
                    modelStatus.status === 'ok'
                      ? 'bg-green-500/20 border border-green-500/50'
                      : modelStatus.status === 'error'
                      ? 'bg-red-500/20 border border-red-500/50'
                      : 'bg-yellow-500/20 border border-yellow-500/50'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  title="Model Health"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    modelStatus.status === 'ok' ? 'bg-green-500' : 
                    modelStatus.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  {/* Tooltip: show available models */}
                  <div className={`absolute left-16 bottom-0 px-3 py-2 rounded text-xs whitespace-nowrap
                    pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity ${
                    isDarkMode ? 'bg-black/90 text-white' : 'bg-white shadow-lg text-gray-900'
                  }`}>
                    <div className="font-semibold">{modelStatus.active || 'Unknown'}</div>
                    <div className="text-[10px] mt-1">
                      {modelStatus.available.length > 0 
                        ? `${modelStatus.available.length} models available`
                        : 'No models found'}
                    </div>
                  </div>
                </motion.button>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Mic Button — Center Bottom ── */}
        {/* Cyan/green gradient when idle, red when recording + pulsing rings */}
        <motion.button
          onClick={handleMicClick}
          className={`relative w-16 h-16 rounded-full flex items-center justify-center
            transition-all backdrop-blur-md shadow-lg z-50 ${
            isRecording
              ? 'bg-red-500/20 border-2 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.6)]'
              : isDarkMode
              ? 'bg-cyan-500/20 border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,255,255,0.4)]'
              : 'bg-cyan-100 border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,200,255,0.3)]'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {/* Pulsing rings when recording */}
          {isRecording && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-500/30"
                animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-500/20"
                animate={{ scale: [1, 1.3], opacity: [1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
              />
            </>
          )}
          
          {/* Mic icon */}
          <Mic className={`w-7 h-7 relative z-10 ${
            isRecording
              ? 'text-red-400'
              : isDarkMode
              ? 'text-cyan-400'
              : 'text-cyan-700'
          }`} />
        </motion.button>
        {/* Start Fresh Button — clears center and leaves minimized orbit balls */}
        <motion.button
          onClick={handleStartFresh}
          style={{ left: 'calc(50% + 72px)', bottom: '18px', transform: 'translateX(-50%)' }}
          className={`absolute w-12 h-12 rounded-full flex items-center justify-center
            transition-all backdrop-blur-md z-50 ${
            isDarkMode
              ? 'bg-white/5 border border-white/10 hover:bg-white/10'
              : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Start Fresh"
        >
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Fresh</span>
        </motion.button>
        
      </div>

      {/* ══════════════════════════════════════════
          LIVE TRANSCRIPT BOX — Bottom Right
          Header: "LIVE TRANSCRIPT" + status dot + mic icon
          Body:   USER (cyan) and AI (purple) messages scrollable
      ══════════════════════════════════════════ */}
      <div className={`absolute bottom-6 right-6 w-80 backdrop-blur-md border
        rounded-lg overflow-hidden z-50 ${
        isDarkMode
          ? 'bg-black/40 border-white/10'
          : 'bg-white/80 border-gray-300'
      }`}>

        {/* Header row */}
        <div className={`flex items-center justify-between px-3 py-2 border-b ${
          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-300'
        }`}>
          <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            LIVE TRANSCRIPT
          </span>

          <div className="flex items-center gap-2">
            {/* Status dot: green=listening, yellow=processing, gray=idle */}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                aiStatus === 'listening'  ? 'bg-green-500 animate-pulse' :
                aiStatus === 'processing' ? 'bg-yellow-500 animate-pulse' :
                'bg-gray-500'
              }`} />
              <span className={`text-[10px] ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {aiStatus === 'listening'  ? 'Listening'  :
                 aiStatus === 'processing' ? 'Processing' :
                 'Idle'}
              </span>
            </div>

            {/* Small mic icon — green when recording, gray when idle */}
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              isRecording ? 'bg-green-500/20' : 'bg-gray-500/20'
            }`}>
              <Mic className={`w-3 h-3 ${isRecording ? 'text-green-400' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>

        {/* Scrollable message list */}
        <div className="h-48 overflow-y-auto p-3 space-y-2 text-xs">
          {transcript.length === 0 ? (
            <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              No conversation yet...
            </p>
          ) : (
            transcript.map((msg, i) => (
              <div key={i} className="space-y-1">
                {/* USER label in cyan, AI label in purple */}
                <div className={`font-semibold ${
                  msg.type === 'user' ? 'text-cyan-400' : 'text-purple-400'
                }`}>
                  {msg.type === 'user' ? 'USER:' : 'AI:'}
                </div>
                <div className={`leading-relaxed pl-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          {/* Auto-scroll anchor — scrolls to bottom on new message */}
          <div ref={transcriptEndRef} />
        </div>
      </div>

    </div>
  );
}
