'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { SpreadingTab } from './types';

type Props = {
  open: boolean;
  onToggle: () => void;
  spreadingCompleted: boolean;
  spreadingStarted: boolean;
  summaryText: string;
  spreadingTab: SpreadingTab;
  onTabChange: (tab: SpreadingTab) => void;
  totalRolls: number;
  layerCount: number;
  styles: Record<string, CSSProperties>;
  children: ReactNode;
};

const TABS: { id: SpreadingTab; label: (p: Props) => string }[] = [
  { id: 'machine', label: () => 'Makine' },
  { id: 'rolls', label: p => `Top / Tartı${p.totalRolls ? ` (${p.totalRolls})` : ''}` },
  { id: 'layers', label: p => `Kat satırları${p.layerCount ? ` (${p.layerCount})` : ''}` },
];

/**
 * Serim paneli kabuğu: başlık, durum ışığı, kapalı özet, sekmeler.
 * İçerik (makine formları, top listesi, kat grid) children olarak verilir.
 */
export function SpreadingDock(props: Props) {
  const {
    open,
    onToggle,
    spreadingCompleted,
    spreadingStarted,
    summaryText,
    spreadingTab,
    onTabChange,
    styles,
    children,
  } = props;

  return (
    <section
      style={{ ...styles.panel, ...styles.spreadingDock, marginTop: '18px' }}
      className="cw-panel"
    >
      <button
        type="button"
        onClick={onToggle}
        style={styles.spreadingToggle}
        aria-expanded={open}
      >
        <div style={styles.spreadingToggleLeft}>
          <span
            style={{
              ...styles.statusLight,
              ...(spreadingCompleted
                ? styles.statusLightCompleted
                : spreadingStarted
                  ? styles.statusLightRunning
                  : styles.statusLightIdle),
            }}
          />
          <div>
            <p style={styles.panelKicker}>SERİM / MAKİNE</p>
            <h2 style={styles.panelTitle}>
              Makine verisi
              <span style={styles.liveBadge}>CANLI</span>
            </h2>
            {!open && <p style={styles.spreadingCollapsedSummary}>{summaryText}</p>}
          </div>
        </div>
        <div style={styles.spreadingToggleRight}>
          <strong style={styles.spreadingToggleStatus}>
            {spreadingCompleted ? 'Tamamlandı' : spreadingStarted ? 'Devam ediyor' : 'Başlatılmadı'}
          </strong>
          <span style={styles.spreadingChevron}>{open ? '−' : '+'}</span>
        </div>
      </button>

      {open && (
        <div style={styles.spreadingBody}>
          <div
            style={styles.spreadingTabs}
            className="cw-spreading-tabs"
            role="tablist"
            aria-label="Serim sekmeleri"
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={spreadingTab === tab.id}
                onClick={() => onTabChange(tab.id)}
                className={spreadingTab === tab.id ? 'cw-spreading-tab-active' : undefined}
                style={{
                  ...styles.spreadingTab,
                  ...(spreadingTab === tab.id ? styles.spreadingTabActive : {}),
                }}
              >
                {tab.label(props)}
              </button>
            ))}
          </div>
          {children}
        </div>
      )}
    </section>
  );
}
