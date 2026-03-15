// LongViewTemplate.tsx — Create in src/components/templates/
// Used when content_weight = "long" — deep dive mode
// Layout: Large image LEFT half + content column RIGHT half + resource icons bottom-right

import { motion } from "framer-motion";
import { ConceptNode } from "../../types";
import { ImageDisplay } from "../ImageDisplay";
import React, { useState, useEffect } from "react";

interface Props {
  node: ConceptNode;
}

export function LongViewTemplate({ node }: Props) {
  const [aspect, setAspect] = useState<number | null>(null);
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Decide which side the image should appear on
  let side: 'left' | 'right' = 'left';
  if (node.side) side = node.side;
  else if (aspect) {
    if (aspect > 1.6) side = 'left';
    else if (aspect < 0.7) side = 'right';
  } else {
    side = (node.mentionCount && node.mentionCount % 2 === 0) ? 'right' : 'left';
  }

  // Typing animation effect for deepContent
  useEffect(() => {
    if (!node.deepContent) return;
    setIsTyping(true);
    setDisplayed('');
    let i = 0;
    const text = node.deepContent;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 18); // 18ms per character — feels natural
    return () => clearInterval(interval);
  }, [node.deepContent]);

  return (
    <motion.div
      className={`flex gap-6 w-full max-w-4xl mx-auto items-start ${side === 'right' ? 'flex-row-reverse' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex-1 min-w-0">
        <ImageDisplay imageUrl={node.imageUrl} maxWidth={480} onAspect={(r) => setAspect(r)} />
      </div>

      <div className="w-72 flex flex-col gap-3 flex-shrink-0">
        <h1 className="text-white font-bold text-2xl leading-tight">{node.concept}</h1>

        <p className="text-gray-300 text-sm leading-relaxed">{node.description}</p>

        <div className="border-t border-white/10 pt-3">
          <h3 className="text-cyan-400 text-xs font-bold mb-2 uppercase tracking-wider">Key Facts</h3>
          <ul className="space-y-1.5">
            {node.key_facts.map((fact, i) => (
              <li key={i} className="text-gray-200 text-sm flex gap-2 items-start">
                <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {displayed && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs font-semibold text-purple-400 uppercase mb-2">
              ▸ Deeper Explanation
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {displayed}
              {isTyping && (
                <span className="inline-block w-1.5 h-4 bg-cyan-400 ml-1 animate-pulse" />
              )}
            </p>
          </div>
        )}

        {node.parts.length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <h3 className="text-purple-400 text-xs font-bold mb-2 uppercase tracking-wider">Components</h3>
            <div className="flex flex-wrap gap-1.5">
              {node.parts.map((part, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded border border-purple-700/40">
                  {part}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.links && node.links.length > 0 && (
          <div className="mt-auto flex gap-2 flex-wrap pt-3 border-t border-white/10">
            <p className="text-gray-500 text-xs w-full mb-1">Resources</p>
            {node.links.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-300 hover:bg-white/20 transition-colors border border-white/10" title={link.label}>
                {link.type === "video" ? "▶" : link.type === "doc" ? "📄" : "🔗"}
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
