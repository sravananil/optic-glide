import { ReactNode } from 'react';

interface RoomCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  accentColor: 'cyan' | 'purple' | 'green';
  onClick?: () => void;
}

export function RoomCard({ icon, title, description, accentColor, onClick }: RoomCardProps) {
  const borderColor = accentColor === 'cyan' ? 'border-cyan-500/40' : accentColor === 'purple' ? 'border-purple-500/40' : 'border-green-500/40';
  const iconColor = accentColor === 'cyan' ? 'text-[#00FFFF]' : accentColor === 'purple' ? 'text-purple-400' : 'text-green-400';
  const glowColor = accentColor === 'cyan' 
    ? 'shadow-[0_0_20px_rgba(0,255,255,0.3)]' 
    : accentColor === 'purple'
    ? 'shadow-[0_0_20px_rgba(168,85,247,0.3)]'
    : 'shadow-[0_0_20px_rgba(16,185,129,0.3)]';
  const hoverGlow = accentColor === 'cyan'
    ? 'hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]'
    : accentColor === 'purple'
    ? 'hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]'
    : 'hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]';

  return (
    <div
      onClick={onClick}
      className={`group relative backdrop-blur-lg bg-white/5 border ${borderColor} rounded-2xl p-8 transition-all duration-500 ${glowColor} ${hoverGlow} hover:bg-white/10 cursor-pointer`}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Content */}
      <div className="relative">
        {/* Icon Circle */}
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${borderColor} ${iconColor} mb-6 bg-white/5`}>
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white mb-3">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Hover accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${accentColor === 'cyan' ? 'bg-[#00FFFF]' : accentColor === 'purple' ? 'bg-purple-500' : 'bg-green-500'} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
    </div>
  );
}