
import React from 'react';
import { Home, Settings, HelpCircle, Scissors, Type, Languages, Wand2, LogOut } from 'lucide-react';
import { AppView, User } from '../../types/studio-episode';
import Logo from './Logo';

interface SidebarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  user: User | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, user, onLogout }) => {
  const navItemClass = (view: AppView | string, isActive: boolean) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer
    ${isActive 
      ? 'bg-episode-500 text-white shadow-lg shadow-episode-600/20' 
      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'}
  `;

  return (
    <div className="w-20 lg:w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col justify-between shrink-0">
      <div>
        {/* Brand Header */}
        <div className="h-24 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-800">
          <div className="relative group cursor-pointer" onClick={() => onChangeView(AppView.DASHBOARD)}>
            <div className="absolute -inset-4 bg-episode-500/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
            <Logo variant="full" className="hidden lg:flex" size={36} is3D={false} />
            <Logo variant="mark" className="lg:hidden" size={32} is3D={false} />
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <div 
            className={navItemClass(AppView.DASHBOARD, currentView === AppView.DASHBOARD)}
            onClick={() => onChangeView(AppView.DASHBOARD)}
          >
            <Home className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Dashboard</span>
          </div>
          
          <div 
            className={navItemClass(AppView.EDITOR, currentView === AppView.EDITOR)}
            onClick={() => onChangeView(AppView.EDITOR)}
          >
            <Scissors className="w-5 h-5" />
            <span className="hidden lg:block font-medium">Editor</span>
          </div>

          <div className="my-4 border-t border-gray-800"></div>
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase hidden lg:block">Studio Tools</div>

          <div className={navItemClass('tools', false)}>
            <Wand2 className="w-5 h-5 text-purple-400" />
            <span className="hidden lg:block">Auto-Cut</span>
          </div>
          <div className={navItemClass('translate', false)}>
            <Languages className="w-5 h-5 text-green-400" />
            <span className="hidden lg:block">Translator</span>
          </div>
          <div className={navItemClass('styles', false)}>
            <Type className="w-5 h-5 text-yellow-400" />
            <span className="hidden lg:block">Styles</span>
          </div>
        </nav>
      </div>

      <div className="p-4 space-y-2">
         {/* User Profile */}
         {user && (
            <div className="hidden lg:flex items-center gap-3 px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-700 mb-2">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${user.avatarColor || 'from-episode-400 to-episode-600'} flex items-center justify-center text-xs font-bold text-white shadow-inner`}>
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-white truncate">{user.name}</span>
                    <span className="text-[10px] text-gray-400 truncate">Editor</span>
                </div>
            </div>
         )}

        <div className={navItemClass('settings', false)}>
          <Settings className="w-5 h-5" />
          <span className="hidden lg:block">Settings</span>
        </div>
        
        <div 
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer text-gray-400 hover:bg-red-500/10 hover:text-red-400"
          onClick={onLogout}
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden lg:block font-medium">Logout</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
