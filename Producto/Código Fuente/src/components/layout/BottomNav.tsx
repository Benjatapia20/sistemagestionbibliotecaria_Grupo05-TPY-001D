import { LayoutDashboard, Library, Settings } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav = ({ activeTab, setActiveTab }: BottomNavProps) => {
  const menuItems = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "catalogo", label: "Catálogo", icon: Library },
    { id: "config", label: "Ajustes", icon: Settings },
  ];

  const activeIndex = menuItems.findIndex(item => item.id === activeTab);

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm z-50">
      <div className="relative flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/50 p-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        
        {/* Indicador Fluido */}
        <div 
          className="absolute h-[calc(100%-16px)] transition-all duration-300 ease-out bg-blue-600 dark:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/30"
          style={{ 
            width: `calc((100% - 16px) / ${menuItems.length})`,
            left: `calc(8px + ((${activeIndex} * (100% - 16px)) / ${menuItems.length}))`
          }}
        />

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-300 z-10 ${
                isActive
                  ? "text-white w-full"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 w-full"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-300 ${isActive ? "scale-110" : "scale-100"}`}
              />
              <span
                className={`text-[10px] font-medium mt-0.5 transition-all duration-300 ${isActive ? "opacity-100" : "opacity-70"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

