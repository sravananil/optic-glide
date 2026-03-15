// DictateMe.tsx
// Real-time speech dictation with three-point flow:
//   GREEN (start) → BLUE (clear) → RED (end/commit)
// No AI, no LLM — pure Web Speech API + visual flow

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptLine {
  id:        number;
  text:      string;
  timestamp: string;
}

interface DictateMeProps {
  onClose: () => void;
}

// ── Waveform bar count
const WAVE_BARS = 28;

export function DictateMe({ onClose }: DictateMeProps) {
  // ── Core state
  const [isListening,    setIsListening]    = useState(false);
  const [isPaused,       setIsPaused]       = useState(false);
  const [interimText,    setInterimText]    = useState('');   // live partial words
  const [activeText,     setActiveText]     = useState('');   // current committed line
  const [history,        setHistory]        = useState<TranscriptLine[]>([]);
  const [flowPhase,      setFlowPhase]      = useState<'green'|'blue'|'red'>('green');
  const [waveHeights,    setWaveHeights]    = useState<number[]>(Array(WAVE_BARS).fill(4));
  const [copied,         setCopied]         = useState(false);
  const [lineCount,      setLineCount]      = useState(0);

  const recognitionRef  = useRef<any>(null);
  const historyEndRef   = useRef<HTMLDivElement>(null);
  const waveIntervalRef = useRef<any>(null);
  const activeTextRef   = useRef('');

  // Keep ref in sync
  useEffect(() => { activeTextRef.current = activeText; }, [activeText]);

  // ── Auto-scroll history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // ── Determine flow phase from text length
  useEffect(() => {
    const len = activeText.length;
    if      (len === 0)   setFlowPhase('green');
    else if (len < 60)    setFlowPhase('green');
    else if (len < 120)   setFlowPhase('blue');
    else                  setFlowPhase('red');
  }, [activeText]);

  // ── Commit current line to history (called at sentence end)
  const commitLine = useCallback((text: string) => {
    if (!text.trim()) return;
    const id = Date.now();
    const ts = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory(prev => [...prev, { id, text: text.trim(), timestamp: ts }]);
    setActiveText('');
    setInterimText('');
    setFlowPhase('green');
    setLineCount(c => c + 1);
  }, []);

  // ── Waveform animation (when listening)
  useEffect(() => {
    if (isListening && !isPaused) {
      waveIntervalRef.current = setInterval(() => {
        setWaveHeights(
          Array.from({ length: WAVE_BARS }, (_, i) => {
            const center = Math.abs(i - WAVE_BARS / 2) / (WAVE_BARS / 2);
            const base   = 4 + (1 - center) * 18;
            return base + Math.random() * 20;
          })
        );
      }, 80);
    } else {
      clearInterval(waveIntervalRef.current);
      setWaveHeights(Array(WAVE_BARS).fill(4));
    }
    return () => clearInterval(waveIntervalRef.current);
  }, [isListening, isPaused]);

  // ── Start recognition
  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition requires Chrome or Edge'); return; }

    const rec           = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-IN';
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim  = '';
      let newFinal = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          newFinal += t + ' ';
        } else {
          interim = t;
        }
      }

      // Interim → show as ghost text at end of active line
      setInterimText(interim);

      if (newFinal) {
        const combined = activeTextRef.current + newFinal;
        // If line is long enough → commit to history
        if (combined.length > 140) {
          commitLine(combined);
        } else {
          setActiveText(combined);
        }
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.error('Speech error:', e.error);
    };

    rec.onend = () => {
      // Auto-restart if not manually paused/stopped
      if (recognitionRef.current === rec && isListening && !isPaused) {
        try { rec.start(); } catch {}
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setIsListening(true);
      setIsPaused(false);
    } catch (e) {
      console.error('Recognition start error:', e);
    }
  }, [isListening, isPaused, commitLine]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setIsPaused(false);
    setInterimText('');
    // Commit any remaining active text
    if (activeTextRef.current.trim()) {
      commitLine(activeTextRef.current);
    }
  }, [commitLine]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      try { recognitionRef.current?.start(); } catch {}
    } else {
      // Pause
      setIsPaused(true);
      recognitionRef.current?.stop();
    }
  }, [isPaused]);

  const clearAll = useCallback(() => {
    setHistory([]);
    setActiveText('');
    setInterimText('');
    setLineCount(0);
    setFlowPhase('green');
  }, []);

  const copyTranscript = useCallback(() => {
    const all = history.map(l => l.text).join('\n') +
      (activeText ? '\n' + activeText : '');
    navigator.clipboard.writeText(all).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }, [history, activeText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      clearInterval(waveIntervalRef.current);
    };
  }, []);

  // ── Flow phase colors
  const phaseColor = {
    green: { dot: '#22c55e', glow: 'rgba(34,197,94,.35)',  text: 'rgba(255,255,255,.95)' },
    blue:  { dot: '#06b6d4', glow: 'rgba(6,182,212,.35)',  text: 'rgba(255,255,255,.85)' },
    red:   { dot: '#ef4444', glow: 'rgba(239,68,68,.35)',  text: 'rgba(255,255,255,.7)'  },
  }[flowPhase];

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-[300]"
      style={{ background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(10px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-[640px] rounded-2xl overflow-hidden"
        style={{
          background:   '#0a0a14',
          border:       '1px solid rgba(255,255,255,.08)',
          boxShadow:    '0 0 80px rgba(0,0,0,.8), 0 0 40px rgba(6,182,212,.06)',
        }}
        initial={{ scale: .93, opacity: 0, y: 20 }}
        animate={{ scale: 1,   opacity: 1, y: 0  }}
        exit={{    scale: .93, opacity: 0, y: 20  }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        {/* ...existing code... */}
      </motion.div>
    </motion.div>
  );
}
