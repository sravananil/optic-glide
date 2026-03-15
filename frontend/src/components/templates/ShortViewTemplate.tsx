// ShortViewTemplate.tsx — Create in src/components/templates/
// Used when content_weight = "short"
// Layout: Small image LEFT + text RIGHT — compact card style

import { motion } from "framer-motion";
import { ConceptNode } from "../../types";
import { ImageDisplay } from "../ImageDisplay";

interface Props {
  node: ConceptNode;
}

export const ShortViewTemplate = ({ node }: Props) => (
  <motion.div
    className="flex gap-4 items-start max-w-2xl mx-auto p-5
      bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm"
    initial={{ opacity: 0, scale: 0.9, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    {/* Small image on the left */}
    <div className="w-36 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
      <ImageDisplay imageUrl={node.imageUrl} maxWidth={144} />
    </div>

    {/* Text content on the right */}
    <div className="flex-1 min-w-0">
      <h2 className="text-white font-bold text-lg mb-1 truncate">
        {node.concept}
      </h2>

      <p className="text-gray-300 text-sm mb-3 leading-relaxed line-clamp-2">
        {node.description}
      </p>

      {/* Key fact chips — max 3 for short template */}
      <div className="flex flex-wrap gap-2">
        {node.key_facts.slice(0, 3).map((fact, i) => (
          <span
            key={i}
            className="text-xs px-2 py-1 bg-cyan-900/40 text-cyan-300
              rounded-full border border-cyan-700/40"
          >
            {fact}
          </span>
        ))}
      </div>
    </div>
  </motion.div>
);
