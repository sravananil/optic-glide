// src/pages/RagApifyRoomInterface.tsx
// OpticGlide — Way 3 RAG Room Interface
//
// What's new vs original RoomInterface.tsx:
//   1. Pre-fetch pen tool (F^ menu) — sends "prefetch" to backend
//   2. Bezier SVG connection lines (Blender-style curved cables)
//   3. TemplateRenderer (Short / Medium / Long template based on content_weight)
//   4. Loading/thinking animation (Strategy 1 — instant feedback)
//   5. Pre-fetch modal with topic detection + progress steps
//   6. media_url reads from content_db Apify image URLs
//   7. All original UI preserved: header, F^ menu, mic, transcript

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, Pen, Power, ZoomIn } from 'lucide-react';
// Adjust these paths if your types/TemplateRenderer are in different locations
import { ConceptNode, AIResponse } from '../../types';
import { TemplateRenderer } from '../../components/TemplateRenderer';


// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────

interface TranscriptMessage {
  type: 'user' | 'ai' | 'system';
  text: string;
  timestamp: Date;
}

interface PrefetchStatus {
  running: boolean;
  done: boolean;
  topics: string[];
  readyTopics: string[];
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const NODE_COLORS = [
  { hex: '#06B6D4', rgb: '6,182,212'   },  // cyan
  { hex: '#8B5CF6', rgb: '139,92,246'  },  // purple
  { hex: '#10B981', rgb: '16,185,129'  },  // green
  { hex: '#F59E0B', rgb: '245,158,11'  },  // amber
  { hex: '#EF4444', rgb: '239,68,68'   },  // red
  { hex: '#EC4899', rgb: '236,72,153'  },  // pink
];

const BLACKBOARD_TRIGGERS = [
  'show image', 'show me', 'let me see',
  'display image', 'show picture',
  'full screen', 'fullscreen', 'zoom in',
];

// Keywords for topic detection in pre-fetch input
const TOPIC_KEYWORDS: Record<string, string> = {
  brain:        'Human Brain',
  heart:        'Human Heart',
  lung:         'Lungs',
  lungs:        'Lungs',
  liver:        'Liver',
  kidney:       'Kidney',
  skeleton:     'Human Skeleton',
  nervous:      'Nervous System',
  laptop:       'Laptop',
  smartphone:   'Smartphone',
  phone:        'Smartphone',
  cat:          'Cat',
  dog:          'Dog',
  elephant:     'Elephant',
  tiger:        'Tiger',
  eagle:        'Eagle',
  function:     'Functions',
  cell:         'Cell Biology',
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const calcMinimizedPosition = (index: number, total: number) => {
  const angle = (index * (360 / Math.max(total, 1)) - 90) * (Math.PI / 180);
  return {
    x: 50 + 33 * Math.cos(angle),
    y: 50 + 27 * Math.sin(angle),
  };
};

const checkBlackboardTrigger = (text: string) =>
  BLACKBOARD_TRIGGERS.some(t => text.toLowerCase().includes(t));

const detectTopicsFromText = (text: string): string[] => {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const [kw, topic] of Object.entries(TOPIC_KEYWORDS)) {
    if (lower.includes(kw)) found.add(topic);
  }
  return Array.from(found);
};

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

// ── Props — onExit goes back to home in App.tsx state navigation
interface RagApifyRoomProps {
  onExit?: () => void;
}

export default function RagApifyRoomInterface({ onExit }: RagApifyRoomProps) {

  // ── Core state ───────────────────────────────
  const [isConnected, setIsConnected]   = useState(false);
  const [isRecording, setIsRecording]   = useState(false);
  const [isListening, setIsListening]   = useState(false);
  const [aiStatus, setAiStatus]         = useState<'idle'|'listening'|'processing'>('idle');
  const [transcript, setTranscript]     = useState<TranscriptMessage[]>([]);
  const [recognition, setRecognition]   = useState<any>(null);

  // ── UI state ─────────────────────────────────
  const [isDarkMode, setIsDarkMode]           = useState(true);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [isDrawingMode, setIsDrawingMode]     = useState(false);
  const [aiPaused, setAiPaused]               = useState(false);
  const [blackboardMode, setBlackboardMode]   = useState(false);
  const [isThinking, setIsThinking]           = useState(false);

  // Fresh-bar lock mode – prevents creation of new cards until toggled
  const [isFreshMode, setIsFreshMode]         = useState(false);

  // ── Node / canvas state ───────────────────────
  const [nodes, setNodes]               = useState<ConceptNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // ── Pre-fetch state ───────────────────────────
  const [prefetchOpen, setPrefetchOpen]     = useState(false);
  const [prefetchInput, setPrefetchInput]   = useState('');
  const [prefetchTopics, setPrefetchTopics] = useState<string[]>([]);
  const [prefetchStatus, setPrefetchStatus] = useState<PrefetchStatus>({
    running: false, done: false, topics: [], readyTopics: [],
  });

  // ── Refs ──────────────────────────────────────
  const wsRef           = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const canvasRef       = useRef<HTMLDivElement>(null);
  const svgRef          = useRef<SVGSVGElement>(null);
  const cardRef         = useRef<HTMLDivElement>(null);

  // ─────────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────────
  const minimizedNodes = nodes.filter(n => n.status === 'minimized');
  const activeNode     = nodes.find(n => n.status === 'active');

  // ─────────────────────────────────────────────
  // BEZIER SVG — draw Blender-style curved lines
  // Called whenever nodes change or canvas resizes
  // ─────────────────────────────────────────────
  const drawBezierLines = useCallback(() => {
    const svg    = svgRef.current;
    const canvas = canvasRef.current;
    const card   = cardRef.current;
    if (!svg || !canvas || !card || minimizedNodes.length === 0) {
      if (svg) svg.innerHTML = '';
      return;
    }

    const W          = canvas.offsetWidth;
    const H          = canvas.offsetHeight;
    const canvasRect = canvas.getBoundingClientRect();
    const cardRect   = card.getBoundingClientRect();

    // Card left-center — input port position
    const cardInputX = cardRect.left - canvasRect.left;
    const cardInputY = cardRect.top  - canvasRect.top + cardRect.height / 2;

    svg.innerHTML = '';

    minimizedNodes.forEach(node => {
      // Node right-center — output port position
      const nodeX = (node.position.x / 100) * W + 22;
      const nodeY = (node.position.y / 100) * H;

      // Tension — wider gap = more curve
      const dx      = Math.abs(cardInputX - nodeX);
      const tension = Math.max(dx * 0.55, 90);

      const c1x = nodeX + tension;
      const c1y = nodeY;
      const c2x = cardInputX - tension;
      const c2y = cardInputY;

      const d = `M ${nodeX} ${nodeY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${cardInputX} ${cardInputY}`;

      const colorRgb = node.color.startsWith('#')
        ? parseInt(node.color.slice(1,3),16)+','+parseInt(node.color.slice(3,5),16)+','+parseInt(node.color.slice(5,7),16)
        : '100,100,200';

      // Glow layer
      const glow = document.createElementNS('http://www.w3.org/2000/svg','path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', `rgba(${colorRgb},0.1)`);
      glow.setAttribute('stroke-width', '9');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);

      // Main line
      const pathId = `bpath-${node.id}`;
      const line   = document.createElementNS('http://www.w3.org/2000/svg','path');
      line.setAttribute('id', pathId);
      line.setAttribute('d', d);
      line.setAttribute('stroke', `rgba(${colorRgb},0.6)`);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);

      // Animated flow dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', node.color);
      dot.setAttribute('opacity', '0.85');

      const anim = document.createElementNS('http://www.w3.org/2000/svg','animateMotion');
      anim.setAttribute('dur', `${2.5 + Math.random() * 1.5}s`);
      anim.setAttribute('repeatCount', 'indefinite');
      anim.setAttribute('begin', `${Math.random() * 2}s`);

      const mpath = document.createElementNS('http://www.w3.org/2000/svg','mpath');
      mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',`#${pathId}`);
      anim.appendChild(mpath);
      dot.appendChild(anim);
      svg.appendChild(dot);
    });
  }, [minimizedNodes]);

  // Redraw lines when nodes or window changes
  useEffect(() => {
    const timer = setTimeout(drawBezierLines, 80);
    return () => clearTimeout(timer);
  }, [drawBezierLines, activeNode]);

  useEffect(() => {
    window.addEventListener('resize', drawBezierLines);
    return () => window.removeEventListener('resize', drawBezierLines);
  }, [drawBezierLines]);

  // ─────────────────────────────────────────────
  // AUTO-SCROLL TRANSCRIPT
  // ─────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ─────────────────────────────────────────────
  // WEBSOCKET
  // ─────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws'); // RAG backend runs on 8001

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'ping' }));
      console.log('✅ WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📦 Received:', data);

      switch (data.type) {

        case 'visualization':
          handleNewConcept(data);
          break;

        case 'low_confidence':
          setAiStatus('idle');
          setIsThinking(false);
          break;

        case 'prefetch_started':
          // Backend ack — update status
          setPrefetchStatus(prev => ({
            ...prev,
            running: true,
            topics: data.topics || [],
          }));
          break;

        case 'prefetch_result':
          // Pre-fetch complete
          setPrefetchStatus(prev => ({
            ...prev,
            running:      false,
            done:         data.success,
            readyTopics:  data.topics || [],
          }));
          if (data.success) {
            addTranscript('system', `⚡ Pre-fetch complete — ${data.count} topics ready for instant display`);
          }
          break;

        case 'error':
          setAiStatus('idle');
          setIsThinking(false);
          break;
      }
    };

    ws.onerror  = () => setIsConnected(false);
    ws.onclose  = () => setIsConnected(false);

    wsRef.current = ws;
    return () => ws.close();
  }, []);

  // ─────────────────────────────────────────────
  // SPEECH RECOGNITION
  // ─────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported. Use Chrome/Edge.'); return; }

    const rec        = new SR();
    rec.continuous   = true;
    rec.interimResults = true;
    rec.lang         = 'en-IN';

    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (!final.trim()) return;

      console.log('🎤', final);

      // Blackboard trigger check
      if (checkBlackboardTrigger(final)) setBlackboardMode(true);

      // Add user message to transcript immediately (Strategy 1 — instant feedback)
      addTranscript('user', final.trim());

      // Show thinking state immediately
      setAiStatus('processing');
      setIsThinking(true);

      // Send to backend
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type:      'text',
          text:      final.trim(),
          timestamp: new Date().toISOString(),
        }));
      }
    };

    rec.onerror = (e: any) => {
      console.error('Speech error:', e.error);
      if (e.error === 'not-allowed') alert('Please allow microphone access');
    };

    rec.onend = () => {
      setIsListening(false);
      setIsRecording(false);
      setAiStatus('idle');
    };

    setRecognition(rec);
  }, []);

  // ─────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────

  const addTranscript = (type: 'user'|'ai'|'system', text: string) => {
    setTranscript(prev => [...prev, { type, text, timestamp: new Date() }]);
  };

  const handleNewConcept = (data: AIResponse) => {
    // Hide thinking state
    setIsThinking(false);
    setAiStatus('idle');

    const source = (data as any).source === 'content_db' ? '⚡ from cache' : '🌐 live fetch';
    addTranscript('ai', `OK! Explaining ${data.concept} [${source}]`);

    // ── CONTENT_ONLY: expand existing card, do NOT create new node ──
    if ((data as any).intent === 'content_only') {
      const currentActive = nodes.find(n => n.status === 'active');
      if (currentActive) {
        setNodes(prev => prev.map(n => {
          if (n.id !== currentActive.id) return n;
          return {
            ...n,
            key_facts: [
              ...n.key_facts,
              ...(data.key_facts || []).filter(f => !n.key_facts.includes(f)),
            ],
            description: n.description
              ? n.description + '\n\n' + (data.description || '')
              : (data.description || n.description),
            content_weight: 'long',
            deepContent: (data as any).full_text || data.description || '',
          } as ConceptNode;
        }));
        return;
      }
    }

    // ── FRESH MODE / LOCKED FLOW ──
    // When not in fresh mode we should keep re‑using the same active card for
    // every new topic: the old content is pushed into the orbit (history) and
    // the active node is updated in place. Only when fresh mode is true do we
    // actually create a brand‑new node. After creating one fresh card we
    // automatically lock again.
    if ((data as any).intent !== 'content_only' && !isFreshMode) {
      const active = nodes.find(n => n.status === 'active');
      if (active) {
        setNodes(prev => {
          const minimizedCount = prev.filter(n => n.status === 'minimized').length;
          const pos = calcMinimizedPosition(minimizedCount, minimizedCount + 1);
          // history copy gets a fresh id so clicking it can restore later
          const historyNode: ConceptNode = {
            ...active,
            id: `node_${Date.now()}`,
            status: 'minimized',
            position: pos,
          };
          const updatedActive: ConceptNode = {
            ...active,
            concept: data.concept,
            imageUrl: (data as any).media_url || '',
            parts: (data as any).parts || [],
            description: data.description || '',
            key_facts: (data as any).key_facts || [],
            content_weight: (data as any).content_weight || 'medium',
            mentionCount: (active.mentionCount || 0) + 1,
            deepContent: '',
          };
          // replace active and append history copy
          return [...prev.map(n => n.id === active.id ? updatedActive : n), historyNode];
        });
        return;
      }
      // fall through if there was no active node
    }

    // ── NORMAL: create new card (either fresh mode or first ever) ──
    setTimeout(() => {
      setNodes(prev => {
        const minimized = prev.map((n, i) => ({
          ...n,
          status:   'minimized' as const,
          position: calcMinimizedPosition(i, prev.length + 1),
        }));
        const newNode: ConceptNode = {
          id:             `node_${Date.now()}`,
          concept:        data.concept,
          imageUrl:       (data as any).media_url || '',
          parts:          (data as any).parts   || [],
          description:    (data as any).description || '',
          key_facts:      (data as any).key_facts   || [],
          links:          (data as any).links        || [],
          content_weight: (data as any).content_weight || 'medium',
          timestamp:      new Date(),
          status:         'active',
          color:          NODE_COLORS[prev.length % NODE_COLORS.length].hex,
          position:       { x: 50, y: 50 },
          mentionCount:   1,
          deepContent:    '',
        };
        setActiveNodeId(newNode.id);
        return [...minimized, newNode];
      });
      // fresh card generated, lock again
      if (isFreshMode) setIsFreshMode(false);
    }, 250);
  };
  const restoreNode = (nodeId: string) => {
    setNodes(prev => {
      let counter = 0;
      return prev.map(n => {
        if (n.id === nodeId)
          return { ...n, status: 'active' as const, position: { x: 50, y: 50 } };
        if (n.status === 'active')
          return { ...n, status: 'minimized' as const, position: calcMinimizedPosition(counter++, prev.length) };
        return { ...n, position: calcMinimizedPosition(counter++, prev.length) };
      });
    });
    setActiveNodeId(nodeId);
  };

  const handleMicClick = () => {
    if (!recognition) { alert('Speech recognition not available'); return; }
    if (isRecording) {
      try { recognition.stop(); } catch {}
      setIsRecording(false);
      setIsListening(false);
      setAiStatus('idle');
    } else {
      if (isListening) return;
      try {
        recognition.start();
        setIsRecording(true);
        setIsListening(true);
        setAiStatus('listening');
      } catch (e: any) {
        if (e?.message?.includes('already started')) {
          setIsRecording(true);
          setIsListening(true);
          setAiStatus('listening');
        }
      }
    }
  };

  const handleRestAI = () => {
    setAiPaused(p => !p);
    if (isRecording && recognition) { try { recognition.stop(); } catch {} setIsRecording(false); }
    wsRef.current?.send(JSON.stringify({ type: 'pause', paused: !aiPaused }));
  };

  const handleSmartZoom = () => {
    if (activeNode) console.log('🔍 Zoom to:', activeNode.concept);
  };

  const handleExitRoom = () => {
    wsRef.current?.close();
    if (onExit) {
      onExit();           // goes back to home via App.tsx state
    } else {
      window.history.back(); // fallback if used standalone
    }
  };

  // ── Pre-fetch handlers ──────────────────────

  const handlePrefetchInputChange = (val: string) => {
    setPrefetchInput(val);
    const detected = detectTopicsFromText(val);
    setPrefetchTopics(detected);
  };

  const handleRunPrefetch = () => {
    if (!prefetchTopics.length) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Not connected to backend'); return;
    }

    // Send prefetch request to backend
    wsRef.current.send(JSON.stringify({
      type:   'prefetch',
      topics: prefetchTopics,
    }));

    setPrefetchStatus({ running: true, done: false, topics: prefetchTopics, readyTopics: [] });
  };

  // Close modal when pre-fetch completes
  useEffect(() => {
    if (prefetchStatus.done) {
      const timer = setTimeout(() => setPrefetchOpen(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [prefetchStatus.done]);

  // ─────────────────────────────────────────────
  // CHIP COLORS for pre-fetch topics
  // ─────────────────────────────────────────────
  const CHIP_STYLES = [
    { bg: 'rgba(0,229,255,.12)',  border: 'rgba(0,229,255,.3)',  text: '#00e5ff' },
    { bg: 'rgba(139,92,246,.12)', border: 'rgba(139,92,246,.3)', text: '#a78bfa' },
    { bg: 'rgba(16,185,129,.12)', border: 'rgba(16,185,129,.3)', text: '#34d399' },
    { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)', text: '#fbbf24' },
    { bg: 'rgba(236,72,153,.12)', border: 'rgba(236,72,153,.3)', text: '#f472b6' },
  ];

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div
      className="relative w-full h-screen overflow-hidden transition-colors duration-500"
      style={{
        background: isDarkMode
          ? '#08080f'
          : 'linear-gradient(to bottom right,#f9fafb,#dbeafe,#f3e8ff)',
      }}
    >

      {/* ── Ambient blobs ── */}
      <div className="absolute inset-0 pointer-events-none">
        {isDarkMode && (
          <>
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px]"/>
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-900/8 blur-[100px]"/>
          </>
        )}
      </div>

      {/* ════════════════ HEADER ════════════════ */}
      <header className="relative z-50 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: 'rgba(8,8,15,.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,.07)' }}>

        <div className="flex items-center gap-3">
          <img src="/assets/logo.png" alt="OG" className="h-9" onError={e => { (e.target as any).style.display='none'; }}/>
          <span className={`text-xl font-bold ${isDarkMode?'text-white':'text-gray-900'}`}>OpticGlide</span>
          <span className="px-3 py-1 rounded text-xs border"
            style={{ background:'rgba(0,229,255,.1)', color:'#00e5ff', borderColor:'rgba(0,229,255,.2)', fontFamily:'monospace' }}>
            [Room Name: Mastered Doctor]
          </span>
          {/* Pre-fetch ready badge */}
          {prefetchStatus.done && (
            <span className="px-2 py-1 rounded text-xs border animate-pulse"
              style={{ background:'rgba(16,185,129,.1)', color:'#10b981', borderColor:'rgba(16,185,129,.25)', fontFamily:'monospace' }}>
              ⚡ {prefetchStatus.readyTopics.length} topics ready
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Dark/light toggle */}
          <motion.button onClick={() => setIsDarkMode(d=>!d)}
            className="p-2 rounded border transition-colors"
            style={{ background:'rgba(255,255,255,.04)', borderColor:'rgba(255,255,255,.1)' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {isDarkMode
              ? <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              : <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            }
          </motion.button>

          {/* Connection status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border text-xs"
            style={{ background:'rgba(255,255,255,.04)', borderColor:'rgba(255,255,255,.1)', color:'#94a3b8' }}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          {/* Exit Room */}
          <button onClick={handleExitRoom}
            className="px-4 py-1.5 rounded text-sm border transition-colors"
            style={{ background:'rgba(239,68,68,.12)', color:'#ef4444', borderColor:'rgba(239,68,68,.25)' }}>
            Exit Room
          </button>

          {/* Settings */}
          <motion.button className="p-2 rounded border"
            style={{ background:'rgba(255,255,255,.04)', borderColor:'rgba(255,255,255,.1)' }}
            whileHover={{ rotate: 90 }} transition={{ duration: 0.3 }}>
            <Settings className="w-4 h-4 text-gray-500"/>
          </motion.button>
        </div>
      </header>

      {/* ════════════════ CANVAS ════════════════ */}
      <div className="relative w-full h-[calc(100vh-57px)]" ref={canvasRef}>

        {/* ── Bezier SVG lines ── */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 8 }}
          xmlns="http://www.w3.org/2000/svg"
        />

        {/* ── Minimized node balls ── */}
        {minimizedNodes.map(node => (
          <motion.div
            key={node.id}
            className="absolute cursor-pointer group"
            style={{
              left: `${node.position.x}%`,
              top:  `${node.position.y}%`,
              transform: 'translate(-50%,-50%)',
              zIndex: 20,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.7 }}
            transition={{ type: 'spring', stiffness: 300 }}
            onClick={() => restoreNode(node.id)}
          >
            {/* Ball */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center border-2 relative"
              style={{
                background:  node.color + '22',
                borderColor: node.color,
                boxShadow:   `0 0 14px ${node.color}44`,
                fontFamily:  'monospace',
                fontSize:    '11px',
                fontWeight:  700,
                color:       node.color,
              }}
            >
              {node.concept.slice(0, 2).toUpperCase()}
              {/* Output port dot — right side */}
              <div
                className="absolute w-2.5 h-2.5 rounded-full border-2"
                style={{
                  right: '-6px', top: '50%', transform: 'translateY(-50%)',
                  background: '#08080f', borderColor: node.color,
                }}
              />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 hidden group-hover:block
              bg-black/90 text-white text-xs px-3 py-1.5 rounded-lg border border-white/15
              whitespace-nowrap z-50 pointer-events-none" style={{ fontFamily:'monospace' }}>
              {node.concept}
              <div className="text-gray-500 text-[9px] mt-0.5">Click to restore</div>
            </div>
          </motion.div>
        ))}

        {/* ── Thinking animation (Strategy 1 — instant feedback) ── */}
        <AnimatePresence>
          {isThinking && !activeNode && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 10 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col items-center gap-5">
                <div className="flex gap-3">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-3 h-3 rounded-full"
                      style={{ background: i === 1 ? '#8b5cf6' : '#00e5ff' }}
                      animate={{ y: [0, -16, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, delay: i * 0.15, repeat: Infinity }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500" style={{ fontFamily:'monospace', letterSpacing:'.08em' }}>
                  AI is thinking...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active concept — TemplateRenderer ── */}
        {/* ref is attached here for bezier line endpoint calculation */}
        <div className="absolute inset-0 flex items-center justify-center px-10" style={{ zIndex: 10 }}>
          <AnimatePresence mode="wait">
            {activeNode && (
              <motion.div
                ref={cardRef}
                key={activeNode.id}
                className="w-full max-w-[860px] relative"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35 }}
              >
                {/* Input port — left edge of card, target for bezier lines */}
                <div
                  className="absolute w-3 h-3 rounded-full border-2 border-cyan-400"
                  style={{
                    left: '-7px', top: '50%', transform: 'translateY(-50%)',
                    background: '#08080f',
                    boxShadow: '0 0 8px rgba(0,229,255,.5)',
                    zIndex: 5,
                  }}
                />
                <TemplateRenderer node={activeNode} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Empty state ── */}
        {!activeNode && !isThinking && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
            <div className="text-center">
              <p className="text-xl text-gray-600">
                {isRecording ? '🎤 Listening...' : 'Click the mic to start'}
              </p>
              <p className="text-xs mt-2 text-gray-700" style={{ fontFamily:'monospace' }}>
                Try: "Show me the human brain"
              </p>
            </div>
          </div>
        )}

        {/* ════════════════ BOTTOM BAR ════════════════ */}
        <div className="absolute bottom-0 left-0 right-0 h-20 flex items-center justify-center pointer-events-none z-50">

          {/* ── F^ Features ── */}
          <div className="absolute left-6 bottom-5 pointer-events-auto z-50">

            {/* Feature menu */}
            <AnimatePresence>
              {featuresExpanded && (
                <motion.div
                  className="absolute bottom-16 left-0 flex flex-col gap-2"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}>

                  {/* PRE-FETCH PEN TOOL — YOUR IDEA */}
                  <div className="relative">
                    <motion.button
                      onClick={() => setPrefetchOpen(true)}
                      className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md relative"
                      style={{
                        background:   'rgba(0,229,255,.1)',
                        border:       prefetchStatus.done ? '2px solid rgba(16,185,129,.5)' : '1px solid rgba(0,229,255,.3)',
                        boxShadow:    prefetchStatus.done ? '0 0 14px rgba(16,185,129,.3)' : undefined,
                      }}
                      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.95 }}
                      title="Pre-fetch Topics Before Class">
                      <Pen className="w-4 h-4" style={{ color: prefetchStatus.done ? '#10b981' : '#00e5ff' }}/>
                      {/* Ready badge */}
                      {prefetchStatus.done && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500
                          flex items-center justify-center text-black text-[8px] font-bold">
                          ✓
                        </div>
                      )}
                    </motion.button>
                    {/* Tooltip */}
                    <div className="absolute left-14 top-1/2 -translate-y-1/2
                      bg-black/90 text-white text-xs px-2 py-1 rounded border border-white/10
                      whitespace-nowrap pointer-events-none opacity-0 hover:opacity-100"
                      style={{ fontFamily:'monospace' }}>
                      Pre-fetch Topics
                    </div>
                  </div>

                  {/* Interactive Draw */}
                  <motion.button
                    onClick={() => setIsDrawingMode(d=>!d)}
                    className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md"
                    style={{
                      background:  isDrawingMode ? '#00e5ff' : 'rgba(255,255,255,.08)',
                      border:      '1px solid rgba(255,255,255,.15)',
                      boxShadow:   isDrawingMode ? '0 0 18px rgba(0,229,255,.55)' : undefined,
                    }}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Pen className={`w-4 h-4 ${isDrawingMode ? 'text-black' : 'text-cyan-400'}`}/>
                  </motion.button>

                  {/* Rest AI */}
                  <motion.button
                    onClick={handleRestAI}
                    className="w-11 h-11 rounded-full flex items-center justify-content backdrop-blur-md"
                    style={{
                      background: aiPaused ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.08)',
                      border:     aiPaused ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(255,255,255,.15)',
                      boxShadow:  aiPaused ? '0 0 18px rgba(239,68,68,.4)' : undefined,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Power className={`w-4 h-4 ${aiPaused ? 'text-red-400' : 'text-gray-400'}`}/>
                  </motion.button>

                  {/* Smart Zoom */}
                  <motion.button
                    onClick={handleSmartZoom}
                    className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md"
                    style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)' }}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <ZoomIn className="w-4 h-4 text-purple-400"/>
                  </motion.button>

                </motion.div>
              )}
            </AnimatePresence>

            {/* F^ button */}
            <motion.button
              onClick={() => setFeaturesExpanded(f=>!f)}
              className="w-13 h-13 rounded-full flex items-center justify-center z-50"
              style={{
                width: '52px', height: '52px',
                background: 'rgba(0,229,255,.13)',
                border:     '2px solid rgba(0,229,255,.38)',
                boxShadow:  featuresExpanded ? '0 0 50px rgba(0,229,255,.6)' : '0 0 22px rgba(0,229,255,.25)',
                color: '#00e5ff', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px',
              }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              F<sup style={{ fontSize: '10px' }}>^</sup>
            </motion.button>
          </div>

          {/* ── Mic + Fresh Bar container ── */}
          <div className="relative pointer-events-auto z-50 flex items-center gap-4">
            {/* Fresh‑bar toggle button */}
            <motion.button
              onClick={() => setIsFreshMode(f => {
                const next = !f;
                addTranscript('system', next ? 'Fresh mode active – next topic will generate a new card' : 'Fresh mode cancelled');
                return next;
              })}
              className="relative px-4 py-3 rounded-full flex items-center gap-2 text-sm"
              style={{
                background: isFreshMode ? 'rgba(16,185,129,.2)' : 'rgba(245,158,11,.1)',
                border: isFreshMode ? '1px solid rgba(16,185,129,.5)' : '1px solid rgba(245,158,11,.35)',
                color: isFreshMode ? '#10b981' : '#fbbf24',
                fontFamily: 'monospace',
                fontWeight: 600,
                boxShadow: isFreshMode ? '0 0 12px rgba(16,185,129,.4)' : undefined,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isFreshMode ? '✦ READY' : '⊞ FRESH'}
              {isFreshMode && (
                <span className="absolute inset-0 rounded-full ring-2 ring-green-400 animate-pulse" />
              )}
            </motion.button>

            {/* Mic Button */}
            <motion.button
              onClick={handleMicClick}
              className="relative"
              whileTap={{ scale: 0.95 }}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: isRecording
                    ? 'rgba(239,68,68,.8)'
                    : 'linear-gradient(135deg,rgba(0,229,255,.75),rgba(16,185,129,.75))',
                  boxShadow: isRecording
                    ? '0 0 38px rgba(239,68,68,.55)'
                    : '0 0 32px rgba(0,229,255,.32)',
                }}>
                <Mic className="w-7 h-7 text-white"/>
              </div>
            {isRecording && (
              <>
                <motion.div className="absolute inset-0 rounded-full border-2 border-red-500/50"
                  animate={{ scale:[1,1.45], opacity:[0.6,0] }}
                  transition={{ repeat:Infinity, duration:1.5 }}/>
                <motion.div className="absolute inset-0 rounded-full border-2 border-red-500/50"
                  animate={{ scale:[1,1.45], opacity:[0.6,0] }}
                  transition={{ repeat:Infinity, duration:1.5, delay:0.5 }}/>
              </>
            )}
          </motion.button>

        </div>
        </div>

        {/* ════════════════ LIVE TRANSCRIPT ════════════════ */}
        <div className="absolute bottom-5 right-5 w-72 rounded-xl overflow-hidden z-50 backdrop-blur-xl"
          style={{ background:'rgba(0,0,0,.5)', border:'1px solid rgba(255,255,255,.07)' }}>

          <div className="flex items-center justify-between px-3 py-2 border-b"
            style={{ background:'rgba(255,255,255,.03)', borderColor:'rgba(255,255,255,.06)' }}>
            <span className="text-xs font-bold text-white" style={{ letterSpacing:'.1em', fontFamily:'monospace' }}>
              LIVE TRANSCRIPT
            </span>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                aiStatus==='listening'  ? 'bg-green-500 animate-pulse'  :
                aiStatus==='processing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600'
              }`}/>
              <span className="text-[10px] text-gray-500" style={{ fontFamily:'monospace' }}>
                {aiStatus==='listening' ? 'Listening' : aiStatus==='processing' ? 'Processing' : 'Idle'}
              </span>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isRecording?'bg-green-500/20':'bg-gray-500/15'}`}>
                <Mic className={`w-3 h-3 ${isRecording?'text-green-400':'text-gray-500'}`}/>
              </div>
            </div>
          </div>

          <div className="h-44 overflow-y-auto p-3 space-y-2 text-xs">
            {transcript.length === 0
              ? <p className="text-center py-8 text-gray-600">No conversation yet...</p>
              : transcript.map((msg, i) => (
                <div key={i} className="space-y-1">
                  {msg.type !== 'system' && (
                    <div className={`font-bold text-[10px] ${
                      msg.type==='user' ? 'text-cyan-400' : 'text-purple-400'
                    }`} style={{ fontFamily:'monospace' }}>
                      {msg.type==='user' ? 'USER:' : 'AI:'}
                    </div>
                  )}
                  <div className={`leading-relaxed pl-2 ${
                    msg.type==='system'
                      ? 'text-green-400/80 text-[9px] font-mono'
                      : 'text-gray-400'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            <div ref={transcriptEndRef}/>
          </div>
        </div>

      </div>{/* end canvas */}

      {/* ════════════════ PRE-FETCH MODAL ════════════════ */}
      <AnimatePresence>
        {prefetchOpen && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-[200]"
            style={{ background:'rgba(0,0,0,.7)', backdropFilter:'blur(8px)' }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>

            <motion.div
              className="w-[480px] rounded-2xl p-7"
              style={{
                background:'#0d0d1a',
                border:'1px solid rgba(0,229,255,.18)',
                boxShadow:'0 0 60px rgba(0,229,255,.08), 0 20px 80px rgba(0,0,0,.6)',
              }}
              initial={{ scale:.92, opacity:0 }}
              animate={{ scale:1, opacity:1 }}
              exit={{ scale:.92, opacity:0 }}
              transition={{ type:'spring', stiffness:300, damping:25 }}>

              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background:'rgba(0,229,255,.1)', border:'1px solid rgba(0,229,255,.2)' }}>
                    <Pen className="w-4 h-4 text-cyan-400"/>
                  </div>
                  <span className="text-sm font-bold text-white" style={{ fontFamily:'monospace' }}>
                    Pre-Fetch Topics Before Class
                  </span>
                </div>
                <button
                  onClick={() => { setPrefetchOpen(false); setPrefetchStatus(s=>({...s,running:false})); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
                  style={{ background:'rgba(255,255,255,.06)' }}>
                  ✕
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Tell OpticGlide what you'll teach today. It will pre-load images &amp; Wikipedia content
                via Apify <span className="text-cyan-400 font-bold">before</span> your session —
                so when you speak, display is <span className="text-green-400 font-bold">instant (0.05s)</span> instead of 2-3s.
              </p>

              {/* Text input */}
              <div className="rounded-xl p-3 mb-4"
                style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.09)' }}>
                <textarea
                  className="w-full bg-transparent outline-none resize-none text-xs text-gray-300 leading-relaxed placeholder-gray-700"
                  rows={3}
                  placeholder="e.g. Today I will discuss about human brain, heart, and functions of nervous system..."
                  value={prefetchInput}
                  onChange={e => handlePrefetchInputChange(e.target.value)}
                  style={{ fontFamily:'inherit' }}
                />
              </div>

              {/* Detected topic chips */}
              {prefetchTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {prefetchTopics.map((t, i) => {
                    const s = CHIP_STYLES[i % CHIP_STYLES.length];
                    return (
                      <motion.span
                        key={t}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border"
                        style={{ background:s.bg, borderColor:s.border, color:s.text, fontFamily:'monospace' }}
                        initial={{ scale:0, opacity:0 }}
                        animate={{ scale:1, opacity:1 }}
                        transition={{ delay: i * 0.05 }}>
                        ⚡ {t}
                      </motion.span>
                    );
                  })}
                </div>
              )}

              {/* Status log during fetch */}
              {prefetchStatus.running && (
                <div className="rounded-lg p-3 mb-4"
                  style={{ background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.15)' }}>
                  <div className="text-[10px] text-green-400 mb-2" style={{ fontFamily:'monospace' }}>
                    ⟳ Fetching via Apify...
                  </div>
                  {prefetchStatus.topics.map((t, i) => (
                    <div key={t} className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                      <div className="w-2 h-2 rounded-full border border-cyan-400/50 border-t-cyan-400 animate-spin"/>
                      {t} — image URL + Wikipedia
                    </div>
                  ))}
                </div>
              )}

              {/* Done state */}
              {prefetchStatus.done && (
                <div className="rounded-lg p-3 mb-4"
                  style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.25)' }}>
                  {prefetchStatus.readyTopics.map(t => (
                    <div key={t} className="flex items-center gap-2 text-[11px] text-green-400 mb-1"
                      style={{ fontFamily:'monospace' }}>
                      <span>✓</span> {t} — ready
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setPrefetchOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-gray-400 border border-white/10
                    hover:bg-white/8 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleRunPrefetch}
                  disabled={!prefetchTopics.length || prefetchStatus.running}
                  className="px-5 py-2 rounded-lg text-xs font-bold border transition-all"
                  style={{
                    background:   'rgba(0,229,255,.12)',
                    borderColor:  'rgba(0,229,255,.3)',
                    color:        '#00e5ff',
                    fontFamily:   'monospace',
                    opacity:      (!prefetchTopics.length || prefetchStatus.running) ? 0.5 : 1,
                    cursor:       (!prefetchTopics.length || prefetchStatus.running) ? 'not-allowed' : 'pointer',
                  }}>
                  {prefetchStatus.running ? '⟳ Fetching...' : '⚡ Pre-Fetch Now'}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
