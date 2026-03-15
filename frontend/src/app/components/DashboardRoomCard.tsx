import { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface DashboardRoomCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  features: string[];
  accentColor: 'cyan' | 'purple' | 'green';
  isSelected?: boolean;
  onEnterRoom?: () => void;
}

export function DashboardRoomCard({ 
  icon, 
  title, 
  subtitle, 
  features, 
  accentColor,
  isSelected,
  onEnterRoom
}: DashboardRoomCardProps) {
  const borderColor = accentColor === 'cyan' ? 'border-cyan-500/40' : accentColor === 'purple' ? 'border-purple-500/40' : 'border-green-500/40';
  const iconColor = accentColor === 'cyan' ? 'text-[#00FFFF]' : accentColor === 'purple' ? 'text-purple-400' : 'text-green-400';
  const iconBgColor = accentColor === 'cyan' ? 'bg-[#00FFFF]/10' : accentColor === 'purple' ? 'bg-purple-500/10' : 'bg-green-500/10';
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
      className={`group relative backdrop-blur-xl bg-white/5 border ${borderColor} rounded-2xl p-8 transition-all duration-500 ${glowColor} ${hoverGlow} hover:bg-white/10 cursor-pointer`}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Content */}
      <div className="relative">
        {/* Icon Circle */}
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${iconBgColor} ${iconColor} mb-6`}>
          {icon}
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white mb-2">
          {title}
        </h3>

        {/* Subtitle */}
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          {subtitle}
        </p>

        {/* Features */}
        <div className="space-y-3">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded flex items-center justify-center ${iconBgColor}`}>
                <Check className={`w-3 h-3 ${iconColor}`} />
              </div>
              <span className="text-gray-300 text-sm">{feature}</span>
            </div>
          ))}
        </div>

        {/* Enter Button */}
        <button 
          onClick={onEnterRoom}
          className={`mt-6 w-full py-3 rounded-lg border ${borderColor} ${iconColor} ${iconBgColor} hover:bg-white/10 transition-all duration-300`}
        >
          Enter Room
        </button>
      </div>

      {/* Hover accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${accentColor === 'cyan' ? 'bg-[#00FFFF]' : accentColor === 'purple' ? 'bg-purple-500' : 'bg-green-500'} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
    </div>
  );
}