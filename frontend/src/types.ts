// types.ts — All shared TypeScript interfaces for OpticGlide

export interface ResourceLink {
  url: string;
  label: string;
  type: 'link' | 'doc' | 'video';
}

export interface ConceptNode {
  id: string;
  concept: string;
  imageUrl: string;
  side?: 'left' | 'right';
  parts: string[];
  description: string;
  key_facts: string[];
  links: ResourceLink[];
  content_weight: 'short' | 'medium' | 'long';
  intent?: 'image_only' | 'image_and_content' | 'content_only';  // NEW: display intent from AI
  timestamp: Date;
  status: 'active' | 'minimized';
  color: string;               // node ball color when minimized
  position: { x: number; y: number }; // % position on canvas when minimized
  mentionCount: number;        // how many times user mentioned this topic
  deepContent?: string;        // holds newly appended deep text for typing animation
}

export interface AIResponse {
  concept: string;
  confidence: number;
  media_url?: string;
  image_url?: string;
  image_path?: string;
  parts: string[];
  description: string;
  key_facts: string[];
  links: ResourceLink[];
  content_weight: 'short' | 'medium' | 'long';
  intent?: 'image_only' | 'image_and_content' | 'content_only';  // NEW: how to display this content
  color?: string;
  type?: string;
  action?: string;
}
