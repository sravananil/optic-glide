// MediumViewTemplate.tsx — DEFAULT template
// Uses dynamic layout based on image aspect ratio

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ConceptNode } from "../../types";
import { ImageDisplay } from "../ImageDisplay";

interface Props {
  node: ConceptNode;
}

export const MediumViewTemplate = ({ node }: Props) => {
  const [aspectRatio, setAspectRatio] = useState(0.66); // default fallback
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
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
  
  // Detect layout based on aspect ratio
  // Wide images (16:9, 19:6): left-right layout
  // Tall/square images: top-bottom layout
  const isWide = aspectRatio > 1;
  const imageMaxWidth = isWide ? 500 : 350;

  return (
    <motion.div
      className={`flex w-full max-w-5xl mx-auto gap-8 ${isWide ? 'flex-row items-center' : 'flex-col'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35 }}
    >
      {/* Left column (for wide images) or top section */}
      <div className={isWide ? 'flex-1 min-w-0' : 'w-full'}>
        <h1 className="text-white font-bold text-3xl tracking-widest mb-4 uppercase text-center sm:text-left">
          {node.concept}
        </h1>

        {/* Main image — detects aspect ratio */}
        <ImageDisplay 
          imageUrl={node.imageUrl} 
          maxWidth={imageMaxWidth}
          onAspect={setAspectRatio}
        />
      </div>

      {/* Right column (for wide images) or bottom section */}
      <div className={isWide ? 'flex-1' : 'w-full'}>
        
        {/* Description paragraph */}
        <p className="text-gray-200 text-sm mb-6 leading-relaxed">
          {node.description}
        </p>

        {/* Key facts — responsive grid */}
        {node.key_facts.length > 0 && (
          <div>
            <div className="text-xs font-bold text-cyan-400 mb-3 tracking-wider">
              KEY FACTS
            </div>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {node.key_facts.map((fact, i) => (
                <div
                  key={i}
                  className="bg-white/5 rounded-lg px-3 py-2 border border-white/10
                    text-cyan-200 text-xs flex gap-2 items-start"
                >
                  <span className="text-cyan-400 mt-0.5 flex-shrink-0">▸</span>
                  <span>{fact}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {displayed && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="text-xs font-semibold text-purple-400 uppercase mb-3">
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

        {/* Components/Parts */}
        {node.parts && node.parts.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-bold text-purple-400 mb-3 tracking-wider">
              COMPONENTS
            </div>
            <div className="flex flex-wrap gap-2">
              {node.parts.map((part, i) => (
                <span
                  key={i}
                  className="bg-purple-500/10 border border-purple-500/30 text-purple-300 
                    text-xs px-3 py-1 rounded-full"
                >
                  {part}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
