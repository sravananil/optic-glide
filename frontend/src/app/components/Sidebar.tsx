import { House, History, LayoutGrid, Settings } from 'lucide-react';
const ogLogoImage = "/assets/logo.png";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onBackToHome?: () => void;
}

export function Sidebar({ activeTab, onTabChange, onBackToHome }: SidebarProps) {
  const menuItems = [
    { id: 'home', label: 'Home', icon: House },
    { id: 'history', label: 'History', icon: History },
    { id: 'rooms', label: 'Rooms', icon: LayoutGrid },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'home' && onBackToHome) {
      onBackToHome();
    } else {
      onTabChange(tabId);
    }
  };

  return (
    <div className="w-64 h-screen backdrop-blur-xl bg-white/5 border-r border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <img src={ogLogoImage} alt="OpticGlide Logo" className="h-10" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                isActive
                  ? 'bg-[#00FFFF]/20 text-[#00FFFF] border border-[#00FFFF]/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}