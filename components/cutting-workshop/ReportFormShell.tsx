'use client';

import type { CSSProperties, ReactNode } from 'react';

type Props = {
  hasOrder: boolean;
  styles: Record<string, CSSProperties>;
  children: ReactNode;
  emptyText?: string;
};

/**
 * Sağ panel: Kesim raporu kabuğu.
 * Form alanları children olarak geçilir (mevcut sayfa state'ine bağlı).
 */
export function ReportFormShell({
  hasOrder,
  styles,
  children,
  emptyText = 'Rapor formunu doldurmak için sol listeden bir iş emri seçin.',
}: Props) {
  return (
    <aside style={styles.reportPanel} className="cw-report-panel">
      <div style={styles.reportHeading}>
        <div>
          <p style={styles.panelKicker}>KAYIT</p>
          <h2 style={styles.panelTitle}>Kesim raporu</h2>
        </div>
      </div>

      {hasOrder ? (
        <div style={styles.formContent}>{children}</div>
      ) : (
        <div style={styles.emptyStateCompact}>
          <p>{emptyText}</p>
        </div>
      )}
    </aside>
  );
}
