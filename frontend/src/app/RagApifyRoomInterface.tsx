// src/components/RagApifyRoomInterface.tsx
// OpticGlide — RAG + Apify Room
//
// FIXES vs previous version:
//   1. F^ features menu — fixed pointer-events and z-index layering
//   2. No Gemini / GPT — backend uses CodeLlama only
//   3. Pre-fetch pen tool — sends prefetch WebSocket message
//   4. Bezier node connection lines (Blender-style)
//   5. Long card template: image left + Wikipedia content right
//   6. media_url from content_db Apify image linkss
//   7. Thinking animation (Strategy 1 — instant feedback)
//   8. No external TemplateRenderer import — self-contained

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, Power, ZoomIn, X } from 'lucide-react';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface ConceptNode {
  id:             string;
  concept:        string;
  imageUrl:       string;
  parts:          string[];
  description:    string;
  key_facts:      string[];
  content_weight: string;
  color:          string;
  position:       { x: number; y: number };
  status:         'active' | 'minimized';
}

interface TranscriptMsg {
  type: 'user' | 'ai' | 'system';
  text: string;
}

interface PrefetchStatus {
  running:     boolean;
  done:        boolean;
  topics:      string[];
  readyTopics: string[];
}

interface Props {
  onExit?: () => void;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const NODE_COLORS = [
  '#06B6D4', '#8B5CF6', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899',
];

// Keywords the pre-fetch modal detects in free text
const PREFETCH_KEYWORDS: Record<string, string> = {
  brain:      'Human Brain',
  heart:      'Human Heart',
  lung:       'Lungs',
  lungs:      'Lungs',
  liver:      'Liver',
  kidney:     'Kidney',
  skeleton:   'Human Skeleton',
  nervous:    'Nervous System',
  neuron:     'Neuron',
  laptop:     'Laptop',
  smartphone: 'Smartphone',
  phone:      'Smartphone',
  cat:        'Cat',
  dog:        'Dog',
  elephant:   'Elephant',
  tiger:      'Tiger',
  eagle:      'Eagle',
  cell:       'Cell Biology',
};

const CHIP_STYLES = [
  { bg: 'rgba(0,229,255,.13)',  border: 'rgba(0,229,255,.35)',  text: '#00e5ff' },
  { bg: 'rgba(139,92,246,.13)', border: 'rgba(139,92,246,.35)', text: '#a78bfa' },
  { bg: 'rgba(16,185,129,.13)', border: 'rgba(16,185,129,.35)', text: '#34d399' },
  { bg: 'rgba(245,158,11,.13)', border: 'rgba(245,158,11,.35)', text: '#fbbf24' },
  { bg: 'rgba(236,72,153,.13)', border: 'rgba(236,72,153,.35)', text: '#f472b6' },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const nodePosition = (index: number, total: number) => {
  const angle = (index * (360 / Math.max(total, 1)) - 90) * (Math.PI / 180);
  return { x: 50 + 33 * Math.cos(angle), y: 50 + 27 * Math.sin(angle) };
};

const detectTopics = (text: string): string[] => {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  // Check longer keywords first to avoid partial matches
  Object.entries(PREFETCH_KEYWORDS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([kw, topic]) => { if (lower.includes(kw)) found.add(topic); });
  return Array.from(found);
};

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
};

// ─────────────────────────────────────────────
// LONG CARD — image left + Wikipedia right
// ─────────────────────────────────────────────
function LongCard({ node }: { node: ConceptNode }) {
  return (
    <div
      className="flex gap-6 w-full rounded-2xl p-5 relative"
      style={{
        background:   'rgba(13,13,26,.82)',
        border:       '1px solid rgba(255,255,255,.09)',
        backdropFilter: 'blur(20px)',
        boxShadow:    '0 0 60px rgba(0,229,255,.05), 0 8px 40px rgba(0,0,0,.5)',
      }}
    >
      {/* Input port dot — for bezier lines */}
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-cyan-400"
        style={{
          left: '-7px', top: '50%', transform: 'translateY(-50%)',
          background: '#08080f',
          boxShadow: '0 0 8px rgba(0,229,255,.5)',
          zIndex: 5,
        }}
      />

      {/* LEFT — Image */}
      <div className="flex-1 min-w-0">
        <div
          className="text-xl font-black uppercase mb-3 text-white"
          style={{ letterSpacing: '.15em' }}
        >
          {node.concept}
        </div>

        <div
          className="rounded-xl overflow-hidden relative bg-black/20"
          style={{ 
            border: '1px solid rgba(255,255,255,.1)',
            aspectRatio: '1.5',
            minHeight: '240px',
          }}
        >
          <img
            src={node.imageUrl}
            alt={node.concept}
            className="w-full object-cover"
            style={{ maxHeight: '240px' }}
            onError={e => {
              // if Apify URL fails, show placeholder
              (e.target as HTMLImageElement).src =
                `https://via.placeholder.com/600x400/111827/00FFFF?text=${node.concept.replace(/ /g, '+')}`;
            }}
          />

          {/* Apify badge on image */}
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-xl text-[9px]"
            style={{
              background: 'rgba(0,0,0,.8)',
              border: '1px solid rgba(0,229,255,.3)',
              color: '#00e5ff',
              fontFamily: 'monospace',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {node.imageUrl.includes('placeholder') ? 'placeholder — pre-fetch for real image' : 'Apify image link'}
          </div>
        </div>
      </div>

      {/* RIGHT — Wikipedia content */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">

        <div className="text-base font-bold text-white leading-snug">{node.concept}</div>

        {/* Wikipedia badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] w-fit"
          style={{
            background: 'rgba(16,185,129,.1)',
            border: '1px solid rgba(16,185,129,.2)',
            color: '#10b981',
            fontFamily: 'monospace',
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Wikipedia · content_db.json
        </div>

        {/* Description */}
        {node.description && (
          <p className="text-[11px] text-gray-400 leading-relaxed">{node.description}</p>
        )}

        {/* Key Facts */}
        {node.key_facts.length > 0 && (
          <div>
            <div
              className="text-[9px] font-bold uppercase mb-1.5 text-cyan-400"
              style={{ letterSpacing: '.12em', fontFamily: 'monospace' }}
            >
              Key Facts
            </div>
            {node.key_facts.slice(0, 4).map((fact, i) => (
              <div key={i} className="flex gap-1.5 mb-1 text-[10px] text-gray-300">
                <span className="text-purple-400 flex-shrink-0 mt-0.5">▸</span>
                <span>{fact}</span>
              </div>
            ))}
          </div>
        )}

        {/* Parts chips */}
        {node.parts.length > 0 && (
          <div>
            <div
              className="text-[9px] font-bold uppercase mb-1.5 text-purple-400"
              style={{ letterSpacing: '.12em', fontFamily: 'monospace' }}
            >
              Components
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.parts.map((part, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(139,92,246,.13)',
                    border: '1px solid rgba(139,92,246,.25)',
                    color: '#c4b5fd',
                  }}
                >
                  {part}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content weight tag */}
        <div
          className="mt-auto px-2.5 py-2 rounded-lg text-[9px] leading-relaxed"
          style={{
            background: 'rgba(16,185,129,.06)',
            border: '1px solid rgba(16,185,129,.15)',
            color: '#10b981',
            fontFamily: 'monospace',
          }}
        >
          📖 content_weight: {node.content_weight}<br />
          LongViewTemplate · RAG data
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function RagApifyRoomInterface({ onExit }: Props) {

  // Core
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiStatus, setAiStatus]       = useState<'idle' | 'listening' | 'processing'>('idle');
  const [isThinking, setIsThinking]   = useState(false);
  const [transcript, setTranscript]   = useState<TranscriptMsg[]>([]);
  const [recognition, setRecognition] = useState<any>(null);

  // Nodes
  const [nodes, setNodes]             = useState<ConceptNode[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // UI
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [aiPaused, setAiPaused]         = useState(false);
  const [isDark]                        = useState(true);
  // Fresh-bar lock mode – prevents creation of new cards until toggled
  const [isFreshMode, setIsFreshMode]   = useState(false);

  // Pre-fetch
  const [penOpen, setPenOpen]           = useState(false);
  const [penInput, setPenInput]         = useState('');
  const [penTopics, setPenTopics]       = useState<string[]>([]);
  const [prefetch, setPrefetch]         = useState<PrefetchStatus>({
    running: false, done: false, topics: [], readyTopics: [],
  });

  // Refs
  const wsRef          = useRef<WebSocket | null>(null);
  const svgRef         = useRef<SVGSVGElement>(null);
  const canvasRef      = useRef<HTMLDivElement>(null);
  const cardRef        = useRef<HTMLDivElement>(null);
  const transcriptEnd  = useRef<HTMLDivElement>(null);

  // Derived
  const minimizedNodes = nodes.filter(n => n.status === 'minimized');
  const activeNode     = nodes.find(n => n.status === 'active') || null;

  // ── Auto scroll transcript ──────────────────
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Add transcript message ──────────────────
  const addMsg = (type: TranscriptMsg['type'], text: string) =>
    setTranscript(prev => [...prev, { type, text }]);

  // ─────────────────────────────────────────────
  // BEZIER LINES — Blender-style curved cables
  // ─────────────────────────────────────────────
  const drawLines = useCallback(() => {
    const svg    = svgRef.current;
    const canvas = canvasRef.current;
    const card   = cardRef.current;
    if (!svg || !canvas) { if (svg) svg.innerHTML = ''; return; }
    if (minimizedNodes.length === 0 || !card) { svg.innerHTML = ''; return; }

    const W          = canvas.offsetWidth;
    const H          = canvas.offsetHeight;
    const cRect      = canvas.getBoundingClientRect();
    const cardRect   = card.getBoundingClientRect();

    const inputX = cardRect.left - cRect.left;
    const inputY = cardRect.top  - cRect.top + cardRect.height / 2;

    svg.innerHTML = '';

    minimizedNodes.forEach((node, idx) => {
      const outX = (node.position.x / 100) * W + 22;
      const outY = (node.position.y / 100) * H;
      const dx      = Math.abs(inputX - outX);
      const tension = Math.max(dx * 0.55, 90);

      const d = `M ${outX} ${outY} C ${outX + tension} ${outY}, ${inputX - tension} ${inputY}, ${inputX} ${inputY}`;
      const rgb = hexToRgb(node.color);
      const pid = `bp-${node.id}`;

      // Glow
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', `rgba(${rgb},.1)`);
      glow.setAttribute('stroke-width', '9');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke-linecap', 'round');
      svg.appendChild(glow);

      // Main cable
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('id', pid);
      line.setAttribute('d', d);
      line.setAttribute('stroke', `rgba(${rgb},.65)`);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);

      // Animated dot flowing along cable
      const dot  = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', node.color);
      dot.setAttribute('opacity', '.85');

      const anim  = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      anim.setAttribute('dur', `${2.5 + idx * 0.4}s`);
      anim.setAttribute('repeatCount', 'indefinite');
      anim.setAttribute('begin', `${idx * 0.5}s`);

      const mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
      mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pid}`);
      anim.appendChild(mp);
      dot.appendChild(anim);
      svg.appendChild(dot);
    });
  }, [minimizedNodes]);

  useEffect(() => {
    const t = setTimeout(drawLines, 100);
    return () => clearTimeout(t);
  }, [drawLines, activeNode]);

  useEffect(() => {
    window.addEventListener('resize', drawLines);
    return () => window.removeEventListener('resize', drawLines);
  }, [drawLines]);

  // ─────────────────────────────────────────────
  // WEBSOCKET
  // ─────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws');
    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'ping' }));
    };
    ws.onmessage = e => handleWsMessage(JSON.parse(e.data));
    ws.onerror   = () => setIsConnected(false);
    ws.onclose   = () => setIsConnected(false);
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const handleWsMessage = (data: any) => {
    switch (data.type) {
      case 'visualization':
        setIsThinking(false);
        setAiStatus('idle');
        addMsg('ai', `Showing: ${data.concept} [${data.source || 'cache'}]`);
        addNodeToCanvas(data);
        break;

      case 'low_confidence':
        setIsThinking(false);
        setAiStatus('idle');
        break;

      case 'prefetch_started':
        setPrefetch(p => ({ ...p, running: true, topics: data.topics || [] }));
        break;

      case 'prefetch_result':
        setPrefetch(p => ({
          ...p,
          running: false,
          done: data.success,
          readyTopics: data.topics || [],
        }));
        if (data.success) {
          addMsg('system', `⚡ ${data.count} topics pre-fetched — instant display ready!`);
        }
        break;
    }
  };

  const addNodeToCanvas = (data: any) => {
    const newConcept = data.concept?.toLowerCase() || '';
    const activeNodeConcept = activeNode?.concept?.toLowerCase() || '';
    const isSameTopic = activeNodeConcept.includes(newConcept.split(' ')[0]) || 
                        newConcept.includes(activeNodeConcept.split(' ')[0]);

    setNodes(prev => {
      if (activeNode && isSameTopic) {
        return prev.map(n => 
          n.id === activeNode.id 
            ? {  // UPDATE existing active node
                ...n,
                concept: data.concept,
                imageUrl: data.media_url || '',
                parts: data.parts || [],
                description: data.description || '',
                key_facts: data.key_facts || [],
                content_weight: data.content_weight || 'medium',
              }
            : n
        );
      }

      // handle locked/fresh logic
      if (!isFreshMode) {
        const active = prev.find(n => n.status === 'active');
        if (active) {
          const miniCount = prev.filter(n => n.status === 'minimized').length;
          const pos = nodePosition(miniCount, miniCount + 1);
          const history: ConceptNode = {
            ...active,
            id: `node_${Date.now()}`,
            status: 'minimized',
            position: pos,
          };
          const updatedActive: ConceptNode = {
            ...active,
            concept: data.concept,
            imageUrl: data.media_url || '',
            parts: data.parts || [],
            description: data.description || '',
            key_facts: data.key_facts || [],
            content_weight: data.content_weight || 'medium',
            // Removed mentionCount property (not in ConceptNode type)
          };
          return [...prev.map(n => n.id === active.id ? updatedActive : n), history];
        }
      }

      const minimized = prev.map((n, i) => ({
        ...n,
        status: 'minimized' as const,
        position: nodePosition(i, prev.length + 1),
      }));

      const newNode: ConceptNode = {
        id: `node_${Date.now()}`,
        concept: data.concept,
        imageUrl: data.media_url || '',
        parts: data.parts || [],
        description: data.description || '',
        key_facts: data.key_facts || [],
        content_weight: data.content_weight || 'medium',
        color: NODE_COLORS[prev.length % NODE_COLORS.length],
        position: { x: 50, y: 50 },
        status: 'active',
        // Removed mentionCount property (not in ConceptNode type)
      };

      setActiveNodeId(newNode.id);
      if (isFreshMode) setIsFreshMode(false);
      return [...minimized, newNode];
    });
  };

  // ─────────────────────────────────────────────
  // SPEECH RECOGNITION
  // ─────────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { console.warn('SpeechRecognition not supported'); return; }

    const rec          = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-IN';

    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (!final.trim()) return;

      addMsg('user', final.trim());

      // Strategy 1 — show thinking immediately
      setAiStatus('processing');
      setIsThinking(true);

      if (wsRef.current?.readyState === WebSocket.OPEN && !aiPaused) {
        wsRef.current.send(JSON.stringify({ type: 'text', text: final.trim() }));
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') alert('Please allow microphone access');
      setIsRecording(false);
      setIsListening(false);
      setAiStatus('idle');
    };

    rec.onend = () => {
      if (isRecording) {
        // Auto-restart if still supposed to be recording
        try { rec.start(); } catch {}
      } else {
        setIsListening(false);
        setAiStatus('idle');
      }
    };

    setRecognition(rec);
  }, []);

  // ─────────────────────────────────────────────
  // MIC HANDLER
  // ─────────────────────────────────────────────
  const handleMic = () => {
    if (!recognition) { alert('Speech recognition not available — use Chrome/Edge'); return; }

    if (isRecording) {
      recognition.stop();
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
      } catch (err: any) {
        if (err?.message?.includes('already started')) {
          setIsRecording(true);
          setIsListening(true);
          setAiStatus('listening');
        }
      }
    }
  };

  // ─────────────────────────────────────────────
  // RESTORE MINIMIZED NODE
  // ─────────────────────────────────────────────
  const restoreNode = (id: string) => {
    setNodes(prev => {
      let counter = 0;
      return prev.map(n => {
        if (n.id === id) return { ...n, status: 'active' as const, position: { x: 50, y: 50 } };
        return { ...n, status: 'minimized' as const, position: nodePosition(counter++, prev.length) };
      });
    });
    setActiveNodeId(id);
  };

  // ─────────────────────────────────────────────
  // PRE-FETCH HANDLERS
  // ─────────────────────────────────────────────
  const handlePenInput = (val: string) => {
    setPenInput(val);
    setPenTopics(detectTopics(val));
  };

  const runPrefetch = () => {
    if (!penTopics.length) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      alert('Not connected to backend (port 8001)'); return;
    }
    wsRef.current.send(JSON.stringify({ type: 'prefetch', topics: penTopics }));
    setPrefetch({ running: true, done: false, topics: penTopics, readyTopics: [] });
  };

  // Auto-close modal 1.5s after success
  useEffect(() => {
    if (prefetch.done) {
      const t = setTimeout(() => setPenOpen(false), 1500);
      return () => clearTimeout(t);
    }
  }, [prefetch.done]);

  // ─────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────
  const handleExit = () => {
    wsRef.current?.close();
    if (onExit) onExit(); else window.history.back();
  };

  const toggleAI = () => {
    const next = !aiPaused;
    setAiPaused(next);
    if (isRecording && recognition) { recognition.stop(); setIsRecording(false); }
    wsRef.current?.send(JSON.stringify({ type: 'pause', paused: next }));
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (    
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: '#08080f', fontFamily: "'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;600;700;900&display=swap');`}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px]"/>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-900/8 blur-[100px]"/>
      </div>

      {/* ════ HEADER ════ */}
      <header
        className="relative z-50 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: 'rgba(8,8,15,.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,.07)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#ef4444,#f59e0b)', fontFamily: 'monospace', boxShadow: '0 0 14px rgba(239,68,68,.3)' }}
          >OG</div>
          <span className="text-lg font-bold text-white">OpticGlide</span>
          <span
            className="px-2.5 py-1 rounded text-xs border"
            style={{ background: 'rgba(0,229,255,.1)', color: '#00e5ff', borderColor: 'rgba(0,229,255,.2)', fontFamily: 'monospace' }}
          >RAG · Apify Room</span>

          {prefetch.done && (
            <span
              className="px-2 py-1 rounded text-xs border animate-pulse"
              style={{ background: 'rgba(16,185,129,.1)', color: '#10b981', borderColor: 'rgba(16,185,129,.25)', fontFamily: 'monospace' }}
            >⚡ {prefetch.readyTopics.length} topics ready</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded border text-xs"
            style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)', color: '#94a3b8' }}
          >
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/>
            {isConnected ? 'Connected · port 8001' : 'Disconnected'}
          </div>
          <button
            onClick={handleExit}
            className="px-4 py-1.5 rounded text-sm border transition-colors"
            style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', borderColor: 'rgba(239,68,68,.25)' }}
          >Exit Room</button>
          <button
            className="p-2 rounded border"
            style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)' }}
          ><Settings className="w-4 h-4 text-gray-500"/></button>
        </div>
      </header>

      {/* ════ CANVAS ════ */}
      <div className="relative w-full h-[calc(100vh-57px)]" ref={canvasRef}>

        {/* Bezier SVG */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 8 }}
        />

        {/* Minimized node balls */}
        {minimizedNodes.map(node => (
          <motion.div
            key={node.id}
            className="absolute cursor-pointer group"
            style={{
              left: `${node.position.x}%`, top: `${node.position.y}%`,
              transform: 'translate(-50%,-50%)', zIndex: 20,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.7 }}
            transition={{ type: 'spring', stiffness: 300 }}
            onClick={() => restoreNode(node.id)}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center border-2 relative"
              style={{
                background: node.color + '22', borderColor: node.color,
                boxShadow: `0 0 14px ${node.color}44`,
                fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: node.color,
              }}
            >
              {node.concept.slice(0, 2).toUpperCase()}
              {/* Output port dot */}
              <div
                className="absolute w-2.5 h-2.5 rounded-full border-2"
                style={{ right: '-6px', top: '50%', transform: 'translateY(-50%)', background: '#08080f', borderColor: node.color }}
              />
            </div>
            {/* Tooltip */}
            <div
              className="absolute bottom-12 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/90 text-white text-xs px-3 py-1.5 rounded-lg border border-white/15 whitespace-nowrap z-50 pointer-events-none"
              style={{ fontFamily: 'monospace' }}
            >
              {node.concept}
              <div className="text-gray-500 text-[9px] mt-0.5">Click to restore</div>
            </div>
          </motion.div>
        ))}

        {/* Thinking animation */}
        <AnimatePresence>
          {isThinking && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 10 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
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
                <span className="text-xs text-gray-500" style={{ fontFamily: 'monospace', letterSpacing: '.08em' }}>
                  CodeLlama is thinking...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active concept card — FIXED to prevent shaking */}
        <div
          className="absolute inset-0 flex items-center justify-center px-10 overflow-y-auto"
          style={{ zIndex: 10 }}
        >
          <AnimatePresence mode="wait">
            {activeNode && (
              <motion.div
                ref={cardRef}
                key={activeNode.id}
                className="w-full max-w-[860px] py-16 my-auto"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                style={{ willChange: 'transform' }}
              >
                <LongCard node={activeNode} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Empty state */}
        {!activeNode && !isThinking && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
            <div className="text-center">
              <p className="text-xl text-gray-600">{isRecording ? '🎤 Listening...' : 'Click the mic to start'}</p>
              <p className="text-xs mt-2 text-gray-700" style={{ fontFamily: 'monospace' }}>
                {prefetch.done ? `⚡ ${prefetch.readyTopics.length} topics pre-fetched — speak to display instantly` : 'Tip: Use F^ → Pen to pre-fetch topics before speaking'}
              </p>
            </div>
          </div>
        )}

        {/* ════ BOTTOM BAR ════ */}
        {/* IMPORTANT: This div has pointer-events-none, children opt in with pointer-events-auto */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ zIndex: 30 }}>

          {/* ── F^ Features ── */}
          {/* pointer-events-auto on this wrapper so clicks work */}
          <div className="absolute left-6 bottom-6 pointer-events-auto">

            {/* Feature buttons — rendered ABOVE the F^ button, show when open */}
            <AnimatePresence>
              {featuresOpen && (
                <motion.div
                  className="absolute bottom-16 left-0 flex flex-col gap-3"
                  style={{ zIndex: 50 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}>

                  {/* ── PRE-FETCH PEN TOOL ── */}
                  <div className="relative group">
                    <motion.button
                      onClick={() => { setPenOpen(true); setFeaturesOpen(false); }}
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: prefetch.done ? 'rgba(16,185,129,.15)' : 'rgba(0,229,255,.1)',
                        border:     prefetch.done ? '2px solid rgba(16,185,129,.5)' : '1px solid rgba(0,229,255,.3)',
                        boxShadow:  prefetch.done ? '0 0 14px rgba(16,185,129,.3)' : undefined,
                      }}
                      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.95 }}
                    >
                      {/* Pen SVG icon */}
                      <svg width="16" height="16" fill="none" stroke={prefetch.done ? '#10b981' : '#00e5ff'} strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      {prefetch.done && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-black text-[8px] font-bold">✓</div>
                      )}
                    </motion.button>
                    <div
                      className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}
                    >Pre-fetch Topics</div>
                  </div>

                  {/* ── AI Pause/Resume ── */}
                  <div className="relative group">
                    <motion.button
                      onClick={toggleAI}
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: aiPaused ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.08)',
                        border:     aiPaused ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(255,255,255,.15)',
                        boxShadow:  aiPaused ? '0 0 18px rgba(239,68,68,.4)' : undefined,
                      }}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                    >
                      <Power className={`w-4 h-4 ${aiPaused ? 'text-red-400' : 'text-gray-400'}`}/>
                    </motion.button>
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap" style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}>
                      {aiPaused ? 'Resume AI' : 'Pause AI'}
                    </div>
                  </div>

                  {/* ── Smart Zoom ── */}
                  <div className="relative group">
                    <motion.button
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                    >
                      <ZoomIn className="w-4 h-4 text-purple-400"/>
                    </motion.button>
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap" style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}>
                      Smart Zoom
                    </div>
            {/* Start Fresh button */}
            <motion.button
              onClick={() => setNodes([])}
              className="relative px-4 py-3 rounded-full flex items-center gap-2 text-sm"
              style={{
                background: 'rgba(245,158,11,.1)',
                border: '1px solid rgba(245,158,11,.35)',
                color: '#fbbf24',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ⟳ Start Fresh
            </motion.button>

          {/* ── Mic button + Start Fresh ── */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-auto flex items-center gap-4">
            
            {/* Start Fresh button */}
            <motion.button
              onClick={() => setNodes([])}
              className="relative px-4 py-3 rounded-full flex items-center gap-2 text-sm"
              style={{
                background: 'rgba(245,158,11,.1)',
                border: '1px solid rgba(245,158,11,.35)',
                color: '#fbbf24',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ⟳ Start Fresh
            </motion.button>

            {/* Mic button */}
            <motion.button
              onClick={handleMic}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: isRecording
                    ? 'rgba(239,68,68,.85)'
                    : 'linear-gradient(135deg,rgba(0,229,255,.75),rgba(16,185,129,.75))',
                  boxShadow: isRecording
                    ? '0 0 38px rgba(239,68,68,.55)'
                    : '0 0 32px rgba(0,229,255,.32)',
                }}>
                <Mic className="w-7 h-7 text-white"/>
              </div>
              {isRecording && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-500/50"
                    animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-500/50"
                    animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                  />
                </>
              )}
            </motion.button>
          </div>

        </div>{/* end bottom bar */}

        {/* ════ LIVE TRANSCRIPT ════ */}
        <div
          className="absolute bottom-5 right-5 w-72 rounded-xl overflow-hidden z-50 backdrop-blur-xl"
          style={{ background: 'rgba(0,0,0,.55)', border: '1px solid rgba(255,255,255,.07)' }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ background: 'rgba(255,255,255,.03)', borderColor: 'rgba(255,255,255,.06)' }}
          >
            <span className="text-xs font-bold text-white" style={{ letterSpacing: '.1em', fontFamily: 'monospace' }}>LIVE TRANSCRIPT</span>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${aiStatus === 'listening' ? 'bg-green-500 animate-pulse' : aiStatus === 'processing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-600'}`}/>
              <span className="text-[10px] text-gray-500" style={{ fontFamily: 'monospace' }}>
                {aiStatus === 'listening' ? 'Listening' : aiStatus === 'processing' ? 'Processing' : 'Idle'}
              </span>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isRecording ? 'bg-green-500/20' : 'bg-gray-500/15'}`}>
                <Mic className={`w-3 h-3 ${isRecording ? 'text-green-400' : 'text-gray-500'}`}/>
              </div>
            </div>
          </div>
          <div className="h-44 overflow-y-auto p-3 space-y-2 text-xs">
            {transcript.length === 0
              ? <p className="text-center py-8 text-gray-600">No conversation yet...</p>
              : transcript.map((msg, i) => (
                <div key={i}>
                  {msg.type !== 'system' && (
                    <div className={`font-bold text-[10px] mb-0.5 ${msg.type === 'user' ? 'text-cyan-400' : 'text-purple-400'}`} style={{ fontFamily: 'monospace' }}>
                      {msg.type === 'user' ? 'USER:' : 'AI:'}
                    </div>
                  )}
                  <div className={`leading-relaxed pl-2 ${msg.type === 'system' ? 'text-green-400/80 text-[9px] font-mono' : 'text-gray-400'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            <div ref={transcriptEnd}/>
          </div>
        </div>

      </div>{/* end canvas */}

      {/* ════ PRE-FETCH MODAL ════ */}
      <AnimatePresence>
        {penOpen && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-[200]"
            style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-[480px] rounded-2xl p-7"
              style={{
                background: '#0d0d1a',
                border: '1px solid rgba(0,229,255,.18)',
                boxShadow: '0 0 60px rgba(0,229,255,.08), 0 20px 80px rgba(0,0,0,.6)',
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,229,255,.1)', border: '1px solid rgba(0,229,255,.2)' }}>
                    <svg width="16" height="16" fill="none" stroke="#00e5ff" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'monospace' }}>Pre-Fetch Topics Before Class</span>
                </div>
                <button
                  onClick={() => { setPenOpen(false); setPrefetch(p => ({ ...p, running: false })); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,.06)' }}
                ><X className="w-4 h-4"/></button>
              </div>

              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Tell OpticGlide what you'll teach today. Apify will fetch image links + Wikipedia content
                <span className="text-cyan-400 font-semibold"> before</span> your session —
                so when you speak, display is <span className="text-green-400 font-semibold">instant (0.05s)</span>.
              </p>

              {/* Text input */}
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.09)' }}>
                <textarea
                  className="w-full bg-transparent outline-none resize-none text-xs text-gray-300 leading-relaxed placeholder-gray-700"
                  rows={3}
                  placeholder="e.g. Today I will discuss about human brain, heart, and functions of nervous system..."
                  value={penInput}
                  onChange={e => handlePenInput(e.target.value)}
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              {/* Detected topic chips */}
              {penTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {penTopics.map((t, i) => {
                    const s = CHIP_STYLES[i % CHIP_STYLES.length];
                    return (
                      <motion.span
                        key={t}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border"
                        style={{ background: s.bg, borderColor: s.border, color: s.text, fontFamily: 'monospace' }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                      >⚡ {t}</motion.span>
                    );
                  })}
                </div>
              )}

              {/* Progress during fetch */}
              {prefetch.running && (
                <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)' }}>
                  <div className="text-[10px] text-green-400 mb-2" style={{ fontFamily: 'monospace' }}>⟳ Fetching via Apify...</div>
                  {prefetch.topics.map(t => (
                    <div key={t} className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                      <div className="w-2 h-2 rounded-full border border-cyan-400/50 border-t-cyan-400 animate-spin"/>
                      {t} — image URL + Wikipedia
                    </div>
                  ))}
                </div>
              )}

              {/* Done state */}
              {prefetch.done && (
                <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)' }}>
                  {prefetch.readyTopics.map(t => (
                    <div key={t} className="flex items-center gap-2 text-[11px] text-green-400 mb-1" style={{ fontFamily: 'monospace' }}>
                      <span>✓</span> {t} — ready
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setPenOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-gray-400 border border-white/10 hover:bg-white/8 transition-colors"
                >Cancel</button>
                <button
                  onClick={runPrefetch}
                  disabled={!penTopics.length || prefetch.running}
                  className="px-5 py-2 rounded-lg text-xs font-bold border transition-all"
                  style={{
                    background:  'rgba(0,229,255,.12)',
                    borderColor: 'rgba(0,229,255,.3)',
                    color:       '#00e5ff',
                    fontFamily:  'monospace',
                    opacity:     (!penTopics.length || prefetch.running) ? 0.5 : 1,
                    cursor:      (!penTopics.length || prefetch.running) ? 'not-allowed' : 'pointer',
                  }}
                >{prefetch.running ? '⟳ Fetching...' : '⚡ Pre-Fetch Now'}</button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
