'use client';

import React from 'react';
import { useTabs, Tab } from './TabContext';
import { useAuth } from './AuthContext';
import { X, User, ChevronDown, LogOut } from 'lucide-react';

interface TabBarProps {
  onLogout: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ onLogout }) => {
  const { tabs, activeTab, setActiveTab, removeTab, closeAllTabs, closeOtherTabs } = useTabs();
  const { user } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{ tabId: string; x: number; y: number } | null>(null);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  };

  const handleCloseAll = () => {
    closeAllTabs();
    setContextMenu(null);
  };

  const handleCloseOthers = () => {
    if (contextMenu) {
      closeOtherTabs(contextMenu.tabId);
      setContextMenu(null);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = () => {
      setUserMenuOpen(false);
      setContextMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-700 px-4 h-12 sticky top-0 z-50">
      {/* Tabs */}
      <div className="flex flex-1 overflow-x-auto scrollbar-hide gap-0.5">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            className={`flex items-center px-4 py-2 min-w-max max-w-xs rounded-t-lg cursor-pointer transition-all duration-200 border-b-2 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-secondary-800 text-primary-700 dark:text-primary-300 border-b-primary-500'
                : 'bg-secondary-50 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400 border-b-secondary-200 dark:border-b-secondary-700 hover:bg-secondary-100 dark:hover:bg-secondary-700'
            }`}
          >
            <span className="flex-1 truncate text-sm font-medium">{tab.title}</span>
            {tab.closable && (
              <button
                onClick={(e) => handleTabClose(e, tab.id)}
                className="ml-2 p-1 rounded hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors text-secondary-500 dark:text-secondary-400"
                title="Sekmeyi kapat"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* User Info */}
      <div className="relative ml-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setUserMenuOpen(!userMenuOpen);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg cursor-pointer transition-all duration-200 hover:bg-secondary-100 dark:hover:bg-secondary-700"
        >
          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-white">
            <User size={14} />
          </div>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 max-w-xs truncate">
            {user?.name || user?.email}
          </span>
          <ChevronDown
            size={14}
            className={`text-secondary-500 dark:text-secondary-400 transition-transform duration-200 ${
              userMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* User Dropdown */}
        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg shadow-lg z-50">
            <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-700">
              <p className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-secondary-600 dark:text-secondary-400 mt-1">
                {user?.email}
              </p>
              <span className="inline-block mt-2 px-2 py-1 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-medium rounded-full">
                {user?.role}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
            >
              <LogOut size={14} />
              Çıkış Yap
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg shadow-lg z-50 min-w-max"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <button
            onClick={handleCloseOthers}
            className="block w-full text-left px-4 py-2 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors first:rounded-t-lg"
          >
            Diğer sekmeleri kapat
          </button>
          <button
            onClick={handleCloseAll}
            className="block w-full text-left px-4 py-2 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors border-t border-secondary-200 dark:border-secondary-700 last:rounded-b-lg"
          >
            Tüm sekmeleri kapat
          </button>
        </div>
      )}
    </div>
  );
};

export default TabBar;
