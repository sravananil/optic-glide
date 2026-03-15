// TemplateRenderer.tsx — Switch component that picks the right template based on content_weight and intent

import { ConceptNode } from "../types";
import { ShortViewTemplate } from "./templates/ShortViewTemplate";
import { MediumViewTemplate } from "./templates/MediumViewTemplate";
import { LongViewTemplate } from "./templates/LongViewTemplate";

interface Props {
  node: ConceptNode;
}

// Simple text-only template for content_only intent
const ContentOnlyTemplate = ({ node }: Props) => (
  <div className="w-full max-w-2xl bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-2xl">
    {/* Concept title */}
    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-4">
      {node.concept}
    </h1>

    {/* Description */}
    {node.description && (
      <div className="text-gray-300 text-sm leading-relaxed mb-4">
        {node.description}
      </div>
    )}

    {/* Key facts */}
    {node.key_facts && node.key_facts.length > 0 && (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-cyan-400 uppercase">Key Facts</h3>
        <ul className="space-y-1 text-xs text-gray-400">
          {node.key_facts.map((fact, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-cyan-400 mt-1">▸</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export const TemplateRenderer = ({ node }: Props) => {
  // NEW: intent can override the template choice
  // "image_only" → always use ShortView (just image)
  // "content_only" → text-only layout (no image)
  // "image_and_content" → normal content_weight logic
  
  if (node.intent === "image_only") {
    return <ShortViewTemplate node={node} />;
  }
  
  if (node.intent === "content_only") {
    return <ContentOnlyTemplate node={node} />;
  }
  
  switch (node.content_weight) {
    case "short":
      return <ShortViewTemplate node={node} />;
    case "long":
      return <LongViewTemplate node={node} />;
    case "medium":
    default:
      return <MediumViewTemplate node={node} />;
  }
};
