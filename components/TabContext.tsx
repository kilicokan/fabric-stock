import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface Tab {
  id: string;
  title: string;
  path: string;
  component: React.ComponentType;
  closable: boolean;
}

interface TabContextType {
  tabs: Tab[];
  activeTab: string | null;
  addTab: (tab: Omit<Tab, 'id'>) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export const useTabs = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
};

interface TabProviderProps {
  children: ReactNode;
  initialTab?: Omit<Tab, 'id'>;
}

export const TabProvider: React.FC<TabProviderProps> = ({ children, initialTab }) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTabState] = useState<string | null>(null);

  // Initialize with home tab
  useEffect(() => {
    if (tabs.length === 0) {
      const homeTab: Tab = {
        id: 'home',
        title: 'Ana Sayfa',
        path: '/',
        component: React.lazy(() => import('../pages/home')),
        closable: false,
      };

      if (initialTab && initialTab.path !== '/' && initialTab.path !== '/home') {
        const bootTab: Tab = {
          ...initialTab,
          id: 'boot',
          closable: initialTab.closable ?? true,
        };
        setTabs([homeTab, bootTab]);
        setActiveTabState('boot');
        return;
      }

      setTabs([homeTab]);
      setActiveTabState('home');
    }
  }, [initialTab, tabs.length]);

  const addTab = (newTab: Omit<Tab, 'id'>) => {
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Check if tab with same path already exists
    const existingTab = tabs.find(tab => tab.path === newTab.path);
    if (existingTab) {
      setActiveTabState(existingTab.id);
      return;
    }

    const tab: Tab = {
      ...newTab,
      id: tabId,
    };

    setTabs(prev => [...prev, tab]);
    setActiveTabState(tabId);
  };

  const removeTab = (tabId: string) => {
    const tabToRemove = tabs.find(tab => tab.id === tabId);
    if (!tabToRemove || !tabToRemove.closable) return;

    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);

      // If removing active tab, activate the previous tab or home
      if (activeTab === tabId) {
        const remainingTabs = newTabs.filter(tab => tab.closable);
        if (remainingTabs.length > 0) {
          setActiveTabState(remainingTabs[remainingTabs.length - 1].id);
        } else {
          setActiveTabState('home');
        }
      }

      return newTabs;
    });
  };

  const setActiveTab = (tabId: string) => {
    setActiveTabState(tabId);
  };

  const closeAllTabs = () => {
    setTabs(prev => prev.filter(tab => !tab.closable));
    setActiveTabState('home');
  };

  const closeOtherTabs = (keepTabId: string) => {
    setTabs(prev => prev.filter(tab => !tab.closable || tab.id === keepTabId));
    setActiveTabState(keepTabId);
  };

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTab,
        addTab,
        removeTab,
        setActiveTab,
        closeAllTabs,
        closeOtherTabs,
      }}
    >
      {children}
    </TabContext.Provider>
  );
};
