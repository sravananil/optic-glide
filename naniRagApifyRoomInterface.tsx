// src/app/components/RagApifyRoomInterface.tsx
// OpticGlide — RAG Room  (fully self-contained, no external TemplateRenderer)
// FIXES vs Copilot version:
//   1. Canvas JSX restored inside return() — was placed outside function body
//   2. Pre-fetch modal inner JSX restored — was a placeholder comment
//   3. F^ toggle button restored
//   4. Bottom bar layout fixed — mic row is sibling of F^ wrapper, not child
//   5. DictateMe import path corrected
//   6. Fresh Bar uses isFreshMode correctly, does NOT wipe nodes
//   7. File upload (PDF/DOC) added to prefetch modal
//   8. isFreshMode stale-closure bug fixed

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Settings, Power, ZoomIn, X } from 'lucide-react';
import { DictateMe } from './DictateMe'; // sibling file — adjust if needed

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
// LONG CARD — image left + content right
// ─────────────────────────────────────────────
function LongCard({ node }: { node: ConceptNode }) {
  return (
    <div
      className="flex gap-6 w-full rounded-2xl p-5 relative"
      style={{
        background:     'rgba(13,13,26,.82)',
        border:         '1px solid rgba(255,255,255,.09)',
        backdropFilter: 'blur(20px)',
        boxShadow:      '0 0 60px rgba(0,229,255,.05), 0 8px 40px rgba(0,0,0,.5)',
      }}
    >
      {/* Input port dot */}
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-cyan-400"
        style={{
          left: '-7px', top: '50%', transform: 'translateY(-50%)',
          background: '#08080f',
          boxShadow: '0 0 8px rgba(0,229,255,.5)',
          zIndex: 5,
        }}
      />

      {/* LEFT — image */}
      <div className="flex-1 min-w-0">
        <div className="text-xl font-black uppercase mb-3 text-white" style={{ letterSpacing: '.15em' }}>
          {node.concept}
        </div>
        <div
          className="rounded-xl overflow-hidden relative bg-black/20"
          style={{ border: '1px solid rgba(255,255,255,.1)', aspectRatio: '1.5', minHeight: '240px' }}
        >
          <img
            src={node.imageUrl}
            alt={node.concept}
            className="w-full object-cover"
            style={{ maxHeight: '240px' }}
            onError={e => {
              (e.target as HTMLImageElement).src =
                `https://via.placeholder.com/600x400/111827/00FFFF?text=${node.concept.replace(/ /g, '+')}`;
            }}
          />
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-xl text-[9px]"
            style={{ background: 'rgba(0,0,0,.8)', border: '1px solid rgba(0,229,255,.3)', color: '#00e5ff', fontFamily: 'monospace' }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {node.imageUrl.includes('placeholder') ? 'placeholder — pre-fetch for real image' : 'local image'}
          </div>
        </div>
      </div>

      {/* RIGHT — content */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="text-base font-bold text-white leading-snug">{node.concept}</div>

        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] w-fit"
          style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: '#10b981', fontFamily: 'monospace' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          RAG · datawarehouse
        </div>

        {node.description && (
          <p className="text-[11px] text-gray-400 leading-relaxed">{node.description}</p>
        )}

        {node.key_facts.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase mb-1.5 text-cyan-400" style={{ letterSpacing: '.12em', fontFamily: 'monospace' }}>
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

        {node.parts.length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase mb-1.5 text-purple-400" style={{ letterSpacing: '.12em', fontFamily: 'monospace' }}>
              Components
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.parts.map((part, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded"
                  style={{ background: 'rgba(139,92,246,.13)', border: '1px solid rgba(139,92,246,.25)', color: '#c4b5fd' }}>
                  {part}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          className="mt-auto px-2.5 py-2 rounded-lg text-[9px] leading-relaxed"
          style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)', color: '#10b981', fontFamily: 'monospace' }}
        >
          📖 content_weight: {node.content_weight}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function RagApifyRoomInterface({ onExit }: Props) {

  // ── Core ──────────────────────────────────
  const [isConnected,   setIsConnected]   = useState(false);
  const [isRecording,   setIsRecording]   = useState(false);
  const [isListening,   setIsListening]   = useState(false);
  const [aiStatus,      setAiStatus]      = useState<'idle' | 'listening' | 'processing'>('idle');
  const [isThinking,    setIsThinking]    = useState(false);
  const [transcript,    setTranscript]    = useState<TranscriptMsg[]>([]);
  const [recognition,   setRecognition]   = useState<any>(null);

  // ── Nodes ─────────────────────────────────
  const [nodes,         setNodes]         = useState<ConceptNode[]>([]);
  const [activeNodeId,  setActiveNodeId]  = useState<string | null>(null);

  // ── UI ────────────────────────────────────
  const [featuresOpen,   setFeaturesOpen]   = useState(false);
  const [aiPaused,       setAiPaused]       = useState(false);
  const [isFreshMode,    setIsFreshMode]    = useState(false);
  const [dictateMeOpen,  setDictateMeOpen]  = useState(false);

  // ── Pre-fetch ─────────────────────────────
  const [penOpen,        setPenOpen]        = useState(false);
  const [penInput,       setPenInput]       = useState('');
  const [penTopics,      setPenTopics]      = useState<string[]>([]);
  const [prefetch,       setPrefetch]       = useState<PrefetchStatus>({
    running: false, done: false, topics: [], readyTopics: [],
  });

  // ── File Upload (prefetch) ─────────────────
  const [uploadedFile,   setUploadedFile]   = useState<File | null>(null);
  const [uploadParsing,  setUploadParsing]  = useState(false);
  const [uploadError,    setUploadError]    = useState('');

  // ── Refs ──────────────────────────────────
  const wsRef         = useRef<WebSocket | null>(null);
  const svgRef        = useRef<SVGSVGElement>(null);
  const canvasRef     = useRef<HTMLDivElement>(null);
  const cardRef       = useRef<HTMLDivElement>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  // ── isFreshMode ref (avoids stale closure in setNodes) ──
  const isFreshModeRef = useRef(false);
  useEffect(() => { isFreshModeRef.current = isFreshMode; }, [isFreshMode]);

  // Derived
  const minimizedNodes = nodes.filter(n => n.status === 'minimized');
  const activeNode     = nodes.find(n => n.status === 'active') || null;

  // ── Auto-scroll transcript ─────────────────
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addMsg = (type: TranscriptMsg['type'], text: string) =>
    setTranscript(prev => [...prev, { type, text }]);

  // ─────────────────────────────────────────────
  // BEZIER LINES
  // ─────────────────────────────────────────────
  const drawLines = useCallback(() => {
    const svg    = svgRef.current;
    const canvas = canvasRef.current;
    const card   = cardRef.current;
    if (!svg || !canvas) { if (svg) svg.innerHTML = ''; return; }
    if (minimizedNodes.length === 0 || !card) { svg.innerHTML = ''; return; }

    const cRect    = canvas.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const W        = canvas.offsetWidth;
    const H        = canvas.offsetHeight;
    const inputX   = cardRect.left - cRect.left;
    const inputY   = cardRect.top  - cRect.top + cardRect.height / 2;

    svg.innerHTML = '';

    minimizedNodes.forEach((node, idx) => {
      const outX    = (node.position.x / 100) * W + 22;
      const outY    = (node.position.y / 100) * H;
      const dx      = Math.abs(inputX - outX);
      const tension = Math.max(dx * 0.55, 90);
      const d       = `M ${outX} ${outY} C ${outX + tension} ${outY}, ${inputX - tension} ${inputY}, ${inputX} ${inputY}`;
      const rgb     = hexToRgb(node.color);
      const pid     = `bp-${node.id}`;

      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d); glow.setAttribute('stroke', `rgba(${rgb},.1)`);
      glow.setAttribute('stroke-width', '9'); glow.setAttribute('fill', 'none');
      svg.appendChild(glow);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('id', pid); line.setAttribute('d', d);
      line.setAttribute('stroke', `rgba(${rgb},.65)`); line.setAttribute('stroke-width', '2');
      line.setAttribute('fill', 'none'); line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);

      const dot  = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '3'); dot.setAttribute('fill', node.color); dot.setAttribute('opacity', '.85');
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
      anim.setAttribute('dur', `${2.5 + idx * 0.4}s`);
      anim.setAttribute('repeatCount', 'indefinite'); anim.setAttribute('begin', `${idx * 0.5}s`);
      const mp = document.createElementNS('http://www.w3.org/2000/svg', 'mpath');
      mp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pid}`);
      anim.appendChild(mp); dot.appendChild(anim); svg.appendChild(dot);
    });
  }, [minimizedNodes]);

  useEffect(() => { const t = setTimeout(drawLines, 100); return () => clearTimeout(t); }, [drawLines, activeNode]);
  useEffect(() => { window.addEventListener('resize', drawLines); return () => window.removeEventListener('resize', drawLines); }, [drawLines]);

  // ─────────────────────────────────────────────
  // WEBSOCKET
  // ─────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8001/ws');
    ws.onopen    = () => { setIsConnected(true); ws.send(JSON.stringify({ type: 'ping' })); };
    ws.onmessage = e => handleWsMessage(JSON.parse(e.data));
    ws.onerror   = () => setIsConnected(false);
    ws.onclose   = () => setIsConnected(false);
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const handleWsMessage = (data: any) => {
    switch (data.type) {
      case 'visualization':
        setIsThinking(false); setAiStatus('idle');
        addMsg('ai', `Showing: ${data.concept} [${data.source || 'cache'}]`);
        addNodeToCanvas(data);
        break;
      case 'low_confidence':
        setIsThinking(false); setAiStatus('idle');
        break;
      case 'prefetch_started':
        setPrefetch(p => ({ ...p, running: true, topics: data.topics || [] }));
        break;
      case 'prefetch_result':
        setPrefetch(p => ({ ...p, running: false, done: data.success, readyTopics: data.topics || [] }));
        if (data.success) addMsg('system', `⚡ ${data.count} topics pre-fetched — instant display ready!`);
        break;
    }
  };

  // ─────────────────────────────────────────────
  // ADD NODE TO CANVAS (Fresh-bar aware, stale-closure safe)
  // ─────────────────────────────────────────────
  const addNodeToCanvas = (data: any) => {
    setNodes(prev => {
      const active = prev.find(n => n.status === 'active');

      // First card ever — always create
      if (!active) {
        const first: ConceptNode = {
          id: `node_${Date.now()}`,
          concept:        data.concept,
          imageUrl:       data.media_url || '',
          parts:          data.parts          || [],
          description:    data.description    || '',
          key_facts:      data.key_facts      || [],
          content_weight: data.content_weight || 'medium',
          color:          NODE_COLORS[0],
          position:       { x: 50, y: 50 },
          status:         'active',
        };
        setTimeout(() => setActiveNodeId(first.id), 0);
        return [first];
      }

      // FIX: read from ref — avoids stale closure
      const freshMode = isFreshModeRef.current;

      if (!freshMode) {
        // LOCKED — replace active card content, push old to orbit
        const miniCount = prev.filter(n => n.status === 'minimized').length;
        const oldAsOrbit: ConceptNode = {
          ...active,
          id:       `node_orbit_${Date.now()}`,
          status:   'minimized',
          position: nodePosition(miniCount, miniCount + 1),
        };
        const updatedActive: ConceptNode = {
          ...active,
          concept:        data.concept,
          imageUrl:       data.media_url || '',
          parts:          data.parts          || [],
          description:    data.description    || '',
          key_facts:      data.key_facts      || [],
          content_weight: data.content_weight || 'medium',
        };
        return [
          ...prev.filter(n => n.status === 'minimized'),
          oldAsOrbit,
          updatedActive,
        ];
      }

      // FRESH MODE — create brand new card, lock again
      setTimeout(() => setIsFreshMode(false), 0);

      const minimized = prev.map((n, i) => ({
        ...n,
        status:   'minimized' as const,
        position: nodePosition(i, prev.length + 1),
      }));

      const newNode: ConceptNode = {
        id:             `node_${Date.now()}`,
        concept:        data.concept,
        imageUrl:       data.media_url || '',
        parts:          data.parts          || [],
        description:    data.description    || '',
        key_facts:      data.key_facts      || [],
        content_weight: data.content_weight || 'medium',
        color:          NODE_COLORS[prev.length % NODE_COLORS.length],
        position:       { x: 50, y: 50 },
        status:         'active',
      };

      setTimeout(() => setActiveNodeId(newNode.id), 0);
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
      setAiStatus('processing');
      setIsThinking(true);
      if (wsRef.current?.readyState === WebSocket.OPEN && !aiPaused) {
        wsRef.current.send(JSON.stringify({ type: 'text', text: final.trim() }));
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') alert('Please allow microphone access');
      setIsRecording(false); setIsListening(false); setAiStatus('idle');
    };

    rec.onend = () => {
      if (isRecording) { try { rec.start(); } catch {} }
      else { setIsListening(false); setAiStatus('idle'); }
    };

    setRecognition(rec);
  }, []);

  // ─────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────
  const handleMic = () => {
    if (!recognition) { alert('Speech recognition not available — use Chrome/Edge'); return; }
    if (isRecording) {
      recognition.stop(); setIsRecording(false); setIsListening(false); setAiStatus('idle');
    } else {
      if (isListening) return;
      try {
        recognition.start(); setIsRecording(true); setIsListening(true); setAiStatus('listening');
      } catch (err: any) {
        if (err?.message?.includes('already started')) {
          setIsRecording(true); setIsListening(true); setAiStatus('listening');
        }
      }
    }
  };

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

  const handlePenInput = (val: string) => { setPenInput(val); setPenTopics(detectTopics(val)); };

  const runPrefetch = () => {
    if (!penTopics.length) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) { alert('Not connected to backend (port 8001)'); return; }
    wsRef.current.send(JSON.stringify({ type: 'prefetch', topics: penTopics }));
    setPrefetch({ running: true, done: false, topics: penTopics, readyTopics: [] });
  };

  // Auto-close modal after prefetch success
  useEffect(() => {
    if (prefetch.done) {
      const t = setTimeout(() => setPenOpen(false), 1500);
      return () => clearTimeout(t);
    }
  }, [prefetch.done]);

  const handleExit = () => { wsRef.current?.close(); if (onExit) onExit(); else window.history.back(); };

  const toggleAI = () => {
    const next = !aiPaused;
    setAiPaused(next);
    if (isRecording && recognition) { recognition.stop(); setIsRecording(false); }
    wsRef.current?.send(JSON.stringify({ type: 'pause', paused: next }));
  };

  // ── FIX: Fresh Bar sets isFreshMode true — does NOT wipe nodes ──
  const handleFreshBar = () => {
    setIsFreshMode(true);
    addMsg('system', '✦ Fresh Bar — next topic will open a new card');
  };

  // ─────────────────────────────────────────────
  // FILE UPLOAD — extract topics from PDF/DOC
  // ─────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setUploadParsing(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res  = await fetch('http://localhost:8001/extract-topics', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.topics && data.topics.length > 0) {
        const merged = [...new Set([...penTopics, ...data.topics])] as string[];
        setPenTopics(merged);
        setPenInput(prev => prev ? prev + '\n' + data.topics.join(', ') : data.topics.join(', '));
      } else {
        setUploadError(data.error || 'No topics found in file');
      }
    } catch {
      setUploadError('Could not connect to backend');
    } finally {
      setUploadParsing(false);
    }
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{ background: '#08080f', fontFamily: "'Outfit', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;600;700;900&display=swap');`}</style>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-purple-900/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-900/8 blur-[100px]" />
      </div>

      {/* ════ HEADER ════ */}
      <header
        className="relative z-50 flex items-center justify-between px-6 py-3 border-b"
        style={{ background: 'rgba(8,8,15,.85)', backdropFilter: 'blur(20px)', borderColor: 'rgba(255,255,255,.07)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#ef4444,#f59e0b)', fontFamily: 'monospace', boxShadow: '0 0 14px rgba(239,68,68,.3)' }}>OG</div>
          <span className="text-lg font-bold text-white">OpticGlide</span>
          <span className="px-2.5 py-1 rounded text-xs border"
            style={{ background: 'rgba(0,229,255,.1)', color: '#00e5ff', borderColor: 'rgba(0,229,255,.2)', fontFamily: 'monospace' }}>
            RAG · Apify Room
          </span>
          {prefetch.done && (
            <span className="px-2 py-1 rounded text-xs border animate-pulse"
              style={{ background: 'rgba(16,185,129,.1)', color: '#10b981', borderColor: 'rgba(16,185,129,.25)', fontFamily: 'monospace' }}>
              ⚡ {prefetch.readyTopics.length} topics ready
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded border text-xs"
            style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)', color: '#94a3b8' }}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {isConnected ? 'Connected · port 8001' : 'Disconnected'}
          </div>
          <button onClick={handleExit}
            className="px-4 py-1.5 rounded text-sm border transition-colors"
            style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444', borderColor: 'rgba(239,68,68,.25)' }}>
            Exit Room
          </button>
          <button className="p-2 rounded border" style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)' }}>
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </header>

      {/* ════ CANVAS ════ */}
      {/* BUG FIXED: This div now has real JSX inside, not a placeholder comment */}
      <div className="relative w-full h-[calc(100vh-57px)]" ref={canvasRef}>

        {/* SVG bezier lines layer */}
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%', zIndex: 1 }}
        />

        {/* ── Minimized orbit nodes ── */}
        {minimizedNodes.map(node => (
          <motion.button
            key={node.id}
            className="absolute flex items-center justify-center rounded-full text-[10px] font-bold cursor-pointer"
            style={{
              left:       `${node.position.x}%`,
              top:        `${node.position.y}%`,
              transform:  'translate(-50%,-50%)',
              width:      '44px',
              height:     '44px',
              background: `rgba(${hexToRgb(node.color)},.15)`,
              border:     `2px solid ${node.color}`,
              boxShadow:  `0 0 16px rgba(${hexToRgb(node.color)},.35)`,
              color:       node.color,
              fontFamily: 'monospace',
              zIndex:     5,
            }}
            onClick={() => restoreNode(node.id)}
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.93 }}
            title={node.concept}
          >
            {node.concept.slice(0, 2).toUpperCase()}
          </motion.button>
        ))}

        {/* ── Thinking animation ── */}
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
                  AI is thinking...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active concept card ── */}
        <div
          className="absolute inset-0 flex items-center justify-center px-10 overflow-y-auto"
          style={{ zIndex: 10 }}
        >
          <AnimatePresence mode="wait">
            {activeNode && (
              <motion.div
                ref={cardRef}
                key={activeNode.id}
                initial={{ opacity: 0, scale: 0.94, y: 18 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{    opacity: 0, scale: 0.94, y: 18  }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                style={{ width: '100%', maxWidth: '860px' }}
              >
                <LongCard node={activeNode} />
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
              <p className="text-xs mt-2 text-gray-700" style={{ fontFamily: 'monospace' }}>
                {prefetch.done
                  ? `⚡ ${prefetch.readyTopics.length} topics pre-fetched — speak to display instantly`
                  : 'Tip: Use F^ → Pen to pre-fetch topics before speaking'}
              </p>
            </div>
          </div>
        )}

        {/* ════ BOTTOM BAR ════ */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ zIndex: 30 }}>

          {/* ── F^ Features wrapper — LEFT side ── */}
          {/* BUG FIXED: this is a standalone positioned div, NOT wrapping the mic */}
          <div className="absolute left-6 bottom-6 pointer-events-auto">

            {/* Feature panel (opens above F^ button) */}
            <AnimatePresence>
              {featuresOpen && (
                <motion.div
                  className="absolute bottom-16 left-0 flex flex-col gap-3"
                  style={{ zIndex: 50 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0  }}
                  exit={{    opacity: 0, y: 12  }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  {/* Pre-fetch pen */}
                  <div className="relative group">
                    <motion.button
                      onClick={() => { setPenOpen(true); setFeaturesOpen(false); }}
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: prefetch.done ? 'rgba(16,185,129,.15)' : 'rgba(0,229,255,.1)',
                        border:     prefetch.done ? '2px solid rgba(16,185,129,.5)' : '1px solid rgba(0,229,255,.3)',
                        boxShadow:  prefetch.done ? '0 0 14px rgba(16,185,129,.3)' : undefined,
                      }}
                      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.95 }}>
                      <svg width="16" height="16" fill="none" stroke={prefetch.done ? '#10b981' : '#00e5ff'} strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      {prefetch.done && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-black text-[8px] font-bold">✓</div>
                      )}
                    </motion.button>
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}>
                      Pre-fetch Topics
                    </div>
                  </div>

                  {/* AI pause */}
                  <div className="relative group">
                    <motion.button onClick={toggleAI}
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: aiPaused ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.08)',
                        border:     aiPaused ? '2px solid rgba(239,68,68,.5)' : '1px solid rgba(255,255,255,.15)',
                        boxShadow:  aiPaused ? '0 0 18px rgba(239,68,68,.4)' : undefined,
                      }}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Power className={`w-4 h-4 ${aiPaused ? 'text-red-400' : 'text-gray-400'}`}/>
                    </motion.button>
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}>
                      {aiPaused ? 'Resume AI' : 'Pause AI'}
                    </div>
                  </div>

                  {/* Smart Zoom */}
                  <div className="relative group">
                    <motion.button
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)' }}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <ZoomIn className="w-4 h-4 text-purple-400"/>
                    </motion.button>
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}>
                      Smart Zoom
                    </div>
                  </div>

                  {/* Dictate Me */}
                  <div className="relative group">
                    <motion.button
                      onClick={() => { setDictateMeOpen(true); setFeaturesOpen(false); }}
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{
                        background: dictateMeOpen ? 'rgba(6,182,212,.2)' : 'rgba(255,255,255,.08)',
                        border:     '1px solid rgba(255,255,255,.15)',
                      }}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                      title="Dictate Me">
                      <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
                      </svg>
                    </motion.button>
                    <div className="absolute left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap"
                      style={{ fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.1)' }}>
                      Dictate Me
                    </div>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* BUG FIXED: F^ toggle button was completely missing — restored here */}
            <motion.button
              onClick={() => setFeaturesOpen(f => !f)}
              className="w-13 h-13 rounded-full flex items-center justify-center"
              style={{
                width: '52px', height: '52px',
                background: 'rgba(0,229,255,.13)',
                border:     '2px solid rgba(0,229,255,.38)',
                boxShadow:  featuresOpen ? '0 0 50px rgba(0,229,255,.6)' : '0 0 22px rgba(0,229,255,.25)',
                color: '#00e5ff', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px',
              }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              F<sup style={{ fontSize: '10px' }}>^</sup>
            </motion.button>
          </div>

          {/* ── Center: Fresh Bar + Mic ── */}
          {/* BUG FIXED: this row is a sibling of the F^ div, NOT nested inside it */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 pointer-events-auto flex items-center gap-4">

            {/* Fresh Bar button — FIX: sets isFreshMode, does NOT wipe nodes */}
            <motion.button
              onClick={handleFreshBar}
              className="flex items-center gap-2 px-4 h-11 rounded-full transition-all duration-300"
              style={{
                background: isFreshMode
                  ? 'linear-gradient(135deg,rgba(16,185,129,.8),rgba(5,150,105,.8))'
                  : 'rgba(255,255,255,.07)',
                border: isFreshMode
                  ? '2px solid rgba(16,185,129,.8)'
                  : '1px solid rgba(255,255,255,.15)',
                boxShadow: isFreshMode ? '0 0 24px rgba(16,185,129,.5)' : 'none',
              }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <span style={{ fontSize: '14px' }}>{isFreshMode ? '✦' : '⊞'}</span>
              <span className="text-xs font-bold"
                style={{
                  fontFamily: 'monospace', letterSpacing: '.06em',
                  color: isFreshMode ? '#fff' : 'rgba(255,255,255,.4)',
                }}>
                {isFreshMode ? 'READY' : 'FRESH'}
              </span>
            </motion.button>

            {/* Mic button */}
            <motion.button onClick={handleMic} whileTap={{ scale: 0.95 }} className="relative">
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
                  <motion.div className="absolute inset-0 rounded-full border-2 border-red-500/50"
                    animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }} />
                  <motion.div className="absolute inset-0 rounded-full border-2 border-red-500/50"
                    animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }} />
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
          <div className="flex items-center justify-between px-3 py-2 border-b"
            style={{ background: 'rgba(255,255,255,.03)', borderColor: 'rgba(255,255,255,.06)' }}>
            <span className="text-xs font-bold text-white" style={{ letterSpacing: '.1em', fontFamily: 'monospace' }}>
              LIVE TRANSCRIPT
            </span>
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
                    <div className={`font-bold text-[10px] mb-0.5 ${msg.type === 'user' ? 'text-cyan-400' : 'text-purple-400'}`}
                      style={{ fontFamily: 'monospace' }}>
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
      {/* BUG FIXED: Full modal JSX restored — was a placeholder comment */}
      <AnimatePresence>
        {penOpen && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-[200]"
            style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-[480px] rounded-2xl p-7"
              style={{ background: '#0d0d1a', border: '1px solid rgba(0,229,255,.18)', boxShadow: '0 0 60px rgba(0,229,255,.08), 0 20px 80px rgba(0,0,0,.6)' }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(0,229,255,.1)', border: '1px solid rgba(0,229,255,.2)' }}>
                    <svg width="16" height="16" fill="none" stroke="#00e5ff" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-white" style={{ fontFamily: 'monospace' }}>Pre-Fetch Topics Before Class</span>
                </div>
                <button
                  onClick={() => { setPenOpen(false); setPrefetch(p => ({ ...p, running: false })); setUploadedFile(null); setUploadError(''); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,.06)' }}>
                  <X className="w-4 h-4"/>
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Tell OpticGlide what you'll teach today — type topics or
                <span className="text-cyan-400 font-semibold"> upload a PDF/DOC</span> to auto-extract them.
                Display becomes <span className="text-green-400 font-semibold">instant (0.05s)</span> after pre-fetch.
              </p>

              {/* Textarea */}
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

              {/* Topic chips */}
              {penTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {penTopics.map((t, i) => {
                    const s = CHIP_STYLES[i % CHIP_STYLES.length];
                    return (
                      <motion.span key={t}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border"
                        style={{ background: s.bg, borderColor: s.border, color: s.text, fontFamily: 'monospace' }}
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}>
                        ⚡ {t}
                      </motion.span>
                    );
                  })}
                </div>
              )}

              {/* Fetch progress */}
              {prefetch.running && (
                <div className="rounded-lg p-3 mb-4" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.15)' }}>
                  <div className="text-[10px] text-green-400 mb-2" style={{ fontFamily: 'monospace' }}>⟳ Fetching...</div>
                  {prefetch.topics.map(t => (
                    <div key={t} className="flex items-center gap-2 text-[11px] text-gray-400 mb-1">
                      <div className="w-2 h-2 rounded-full border border-cyan-400/50 border-t-cyan-400 animate-spin"/>
                      {t} — image + datawarehouse
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

              {/* ── Actions row with Upload button ── */}
              <div className="flex items-center justify-between">

                {/* LEFT: Upload PDF/DOC */}
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => document.getElementById('prefetch-file-input')?.click()}
                    disabled={uploadParsing}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all"
                    style={{
                      background:  uploadedFile ? 'rgba(16,185,129,.1)' : 'rgba(255,255,255,.04)',
                      borderColor: uploadedFile ? 'rgba(16,185,129,.35)' : 'rgba(255,255,255,.1)',
                      color:       uploadedFile ? '#10b981' : '#6b7280',
                    }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    {uploadParsing ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        <span>Reading...</span>
                      </>
                    ) : uploadedFile ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                        <span className="max-w-[100px] truncate">{uploadedFile.name}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                        <span>Upload PDF / DOC</span>
                      </>
                    )}
                  </motion.button>

                  {/* Hidden file input */}
                  <input id="prefetch-file-input" type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
                  />

                  {uploadError && (
                    <span className="text-[10px] text-red-400" style={{ fontFamily: 'monospace' }}>⚠ {uploadError}</span>
                  )}
                </div>

                {/* RIGHT: Cancel + Pre-Fetch Now */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setPenOpen(false); setUploadedFile(null); setUploadError(''); }}
                    className="px-4 py-2 rounded-lg text-xs text-gray-400 border border-white/10 hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
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
                    }}>
                    {prefetch.running ? '⟳ Fetching...' : '⚡ Pre-Fetch Now'}
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ DICTATE ME MODAL ════ */}
      <AnimatePresence>
        {dictateMeOpen && (
          <DictateMe onClose={() => setDictateMeOpen(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}
