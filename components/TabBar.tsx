import React from 'react';
import { useTabs, Tab } from './TabContext';
import { useAuth } from './AuthContext';
import { X, User, ChevronDown, LogOut, MoreVertical } from 'lucide-react';

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
    <div style={styles.tabBar}>
      {/* Tabs */}
      <div style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {}),
            }}
            onClick={() => handleTabClick(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
          >
            <span style={styles.tabTitle}>{tab.title}</span>
            {tab.closable && (
              <button
                style={styles.closeButton}
                onClick={(e) => handleTabClose(e, tab.id)}
                title="Sekmeyi kapat"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* User Info */}
      <div style={styles.userSection}>
        <div
          style={styles.userInfo}
          onClick={(e) => {
            e.stopPropagation();
            setUserMenuOpen(!userMenuOpen);
          }}
        >
          <div style={styles.avatar}>
            <User size={16} />
          </div>
          <span style={styles.userName}>{user?.name || user?.email}</span>
          <ChevronDown size={14} style={{...styles.chevron, transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'}} />
        </div>

        {/* User Dropdown */}
        {userMenuOpen && (
          <div style={styles.userDropdown}>
            <div style={styles.userDetails}>
              <p style={styles.userDetailName}>{user?.name || user?.email}</p>
              <p style={styles.userDetailEmail}>{user?.email}</p>
              <span style={styles.userRole}>{user?.role}</span>
            </div>
            <button style={styles.logoutButton} onClick={onLogout}>
              <LogOut size={14} />
              Çıkış Yap
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            ...styles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button style={styles.contextMenuItem} onClick={handleCloseOthers}>
            Diğer sekmeleri kapat
          </button>
          <button style={styles.contextMenuItem} onClick={handleCloseAll}>
            Tüm sekmeleri kapat
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e1e5e9',
    padding: '0 16px',
    height: '48px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 1000,
  },
  tabsContainer: {
    display: 'flex',
    flex: 1,
    overflowX: 'auto',
    scrollbarWidth: 'none' as const,
    msOverflowStyle: 'none' as const,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    marginRight: '2px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #e1e5e9',
    borderBottom: 'none',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    minWidth: '120px',
    maxWidth: '200px',
    position: 'relative' as const,
    transition: 'all 0.2s ease',
  },
  activeTab: {
    backgroundColor: '#ffffff',
    borderBottom: '2px solid #007bff',
    marginBottom: '-1px',
  },
  tabTitle: {
    flex: 1,
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    color: '#6c757d',
    marginLeft: '8px',
    transition: 'all 0.2s ease',
  },
  userSection: {
    position: 'relative' as const,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #e1e5e9',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  avatar: {
    width: '24px',
    height: '24px',
    backgroundColor: '#007bff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#495057',
    maxWidth: '120px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  chevron: {
    color: '#6c757d',
    transition: 'transform 0.2s ease',
  },
  userDropdown: {
    position: 'absolute' as const,
    right: 0,
    top: '100%',
    marginTop: '4px',
    width: '200px',
    backgroundColor: 'white',
    border: '1px solid #e1e5e9',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    padding: '8px 0',
    zIndex: 1001,
  },
  userDetails: {
    padding: '12px 16px',
    borderBottom: '1px solid #e9ecef',
  },
  userDetailName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#495057',
    margin: '0 0 4px 0',
  },
  userDetailEmail: {
    fontSize: '12px',
    color: '#6c757d',
    margin: '0 0 8px 0',
  },
  userRole: {
    display: 'inline-block',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: '500',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#dc3545',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s ease',
  },
  contextMenu: {
    position: 'fixed' as const,
    backgroundColor: 'white',
    border: '1px solid #e1e5e9',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    padding: '4px 0',
    zIndex: 1002,
    minWidth: '160px',
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    color: '#495057',
    transition: 'background-color 0.2s ease',
  },
} as const;

// Add CSS for scrollbar hiding
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .tabs-container::-webkit-scrollbar {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

export default TabBar;
