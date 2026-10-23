import React from 'react';
import { Tab, TabProvider } from './TabContext';
import TabBar from './TabBar';
import TabContent from './TabContent';
import Sidebar from './Layout/Sidebar';
import { useAuth } from './AuthContext';
import ErpAssistant from './ErpAssistant';

interface TabbedLayoutProps {
  initialTab?: Omit<Tab, 'id'>;
}

const TabbedLayoutInner: React.FC = () => {
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-secondary-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-h-0">
        <TabBar onLogout={handleLogout} />
        <TabContent />
      </div>
      <ErpAssistant />
    </div>
  );
};

const TabbedLayout: React.FC<TabbedLayoutProps> = ({ initialTab }) => {
  return (
    <TabProvider initialTab={initialTab}>
      <TabbedLayoutInner />
    </TabProvider>
  );
};

export default TabbedLayout;
