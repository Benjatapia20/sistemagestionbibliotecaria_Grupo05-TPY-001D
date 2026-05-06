import { useState } from 'react';
import { BookOpen, LayoutDashboard, Library, ChevronLeft, ChevronRight, Settings, Heart } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: 'admin' | 'usuario';
}

export const Sidebar = ({ activeTab, setActiveTab, userRole }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard, adminOnly: true },
    { id: 'catalogo', label: 'Catálogo', icon: Library, adminOnly: false },
    { id: 'favoritos', label: 'Favoritos', icon: Heart, adminOnly: false },
    { id: 'config', label: 'Ajustes', icon: Settings, adminOnly: false },
  ].filter(item => !item.adminOnly || userRole === 'admin');

  return (
    <aside className={`hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} min-h-screen relative`}>
      <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
        <BookOpen className="text-blue-600 dark:text-blue-400 w-8 h-8 shrink-0" />
        {!isCollapsed && (
          <span className="font-bold text-xl text-slate-800 dark:text-white ml-3 whitespace-nowrap">
            BiblioResiliente
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-3 rounded-xl transition-colors ${
                isActive 
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="ml-3">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Botón Colapsar en la base */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} px-3 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors`}
          title={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
          {!isCollapsed && <span className="ml-3 font-medium">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
};
