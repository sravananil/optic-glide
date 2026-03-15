// ImageDisplay.tsx — Smart image renderer with natural aspect ratio + blackboard fullscreen mode
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageDisplayProps {
  imageUrl: string;
  maxWidth?: number;
  blackboardMode?: boolean;    // true = fullscreen, all text hidden
  onExitBlackboard?: () => void;
  onAspect?: (ratio: number) => void; // width / height
}

export const ImageDisplay = ({
  imageUrl,
  maxWidth = 450,
  blackboardMode = false,
  onExitBlackboard,
  onAspect,
}: ImageDisplayProps) => {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  // When image loads, capture its natural dimensions
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight || 1;
    setDimensions({ w, h });
    try {
      if (typeof onAspect === "function") onAspect(w / h);
    } catch (e) {
      // swallow callback errors to avoid breaking rendering
    }
  };

  // Compute display size while preserving original aspect ratio
  const getDisplayStyle = (overrideMaxWidth?: number) => {
    const w = overrideMaxWidth || maxWidth;
    // Before load, use an estimated ratio (0.66) to reserve space and reduce layout shift
    if (!dimensions) return { width: w, height: Math.round(w * 0.66) };
    const ratio = dimensions.h / dimensions.w;
    return { width: w, height: Math.round(w * ratio) };
  };

  // BLACKBOARD MODE — fullscreen overlay, all canvas content hidden behind this
  if (blackboardMode) {
    const screenMaxW = typeof window !== "undefined" ? window.innerWidth - 80 : 900;
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.img
            src={imageUrl}
            style={getDisplayStyle(Math.min(dimensions?.w || screenMaxW, screenMaxW))}
            className="rounded-xl shadow-2xl shadow-cyan-500/20 object-contain"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            onLoad={handleLoad}
          />
          {/* Exit button top-right */}
          <button
            onClick={onExitBlackboard}
            className="absolute top-6 right-6 text-white/60 hover:text-white
              text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20
              transition-colors border border-white/20"
          >
            ✕ Exit Fullscreen
          </button>
          {/* Small hint at bottom */}
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2
            text-white/30 text-xs">
            Say "continue" or click ✕ to return
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  // NORMAL MODE — inline image with natural aspect ratio
  const style = getDisplayStyle();
  return (
    <div style={{ width: style.width }} className="mx-auto">
      <div
        style={{ width: style.width, height: style.height }}
        className="relative overflow-hidden rounded-xl bg-black/20"
      >
        <motion.img
          src={imageUrl}
          style={{ width: '100%', height: '100%' }}
          className="object-contain"
          onLoad={handleLoad}
          layoutId={`image_${imageUrl}`} // enables smooth shared layout animation
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
};
