import React, { Suspense } from 'react';
import { useTabs } from './TabContext';

const TabContent: React.FC = () => {
  const { tabs, activeTab } = useTabs();

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  if (!activeTabData) {
    return (
      <div style={styles.emptyState}>
        <h3>Hoş geldiniz</h3>
        <p>Menüden bir sayfa seçin veya yeni bir sekme açın.</p>
      </div>
    );
  }

  const Component = activeTabData.component;

  return (
    <div style={styles.content}>
      <Suspense fallback={<div style={styles.loading}>Yükleniyor...</div>}>
        <Component />
      </Suspense>
    </div>
  );
};

const styles = {
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#f8f9fa',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center' as const,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    fontSize: '16px',
    color: '#6c757d',
  },
};

export default TabContent;
