import React from 'react';
import { TabProvider, useTabs } from './TabContext';
import TabBar from './TabBar';
import TabContent from './TabContent';
import Sidebar from './Layout/Sidebar';
import { useAuth } from './AuthContext';

interface TabbedLayoutProps {
  children?: React.ReactNode;
}

const TabbedLayoutInner: React.FC<TabbedLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { addTab } = useTabs();

  const handleLogout = () => {
    logout();
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainArea}>
        <TabBar onLogout={handleLogout} />
        <TabContent />
      </div>
    </div>
  );
};

const TabbedLayout: React.FC<TabbedLayoutProps> = ({ children }) => {
  return (
    <TabProvider>
      <TabbedLayoutInner>{children}</TabbedLayoutInner>
    </TabProvider>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
  },
};

export default TabbedLayout;
