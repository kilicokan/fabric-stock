'use client';

import type { CSSProperties } from 'react';
import { WORKFLOW_STEPS, type WorkflowStepId } from './types';

export type PrimaryCta = {
  label: string;
  action: () => void;
  tone: 'primary' | 'teal' | 'success' | 'neutral';
  disabled: boolean;
};

type Props = {
  cta: PrimaryCta;
  activeStep: WorkflowStepId;
  styles: Record<string, CSSProperties>;
};

export function PrimaryCtaBar({ cta, activeStep, styles }: Props) {
  return (
    <div style={styles.primaryCtaBar} className="cw-primary-cta">
      <div style={styles.primaryCtaHint}>
        <span style={styles.primaryCtaStep}>
          {WORKFLOW_STEPS.find(s => s.id === activeStep)?.label || 'Adım'}
        </span>
        <span style={styles.primaryCtaHintText}>Sıradaki işlem</span>
      </div>
      <button
        type="button"
        onClick={cta.action}
        disabled={cta.disabled}
        style={{
          ...styles.primaryCtaButton,
          ...(cta.tone === 'teal' ? styles.primaryCtaButtonTeal : {}),
          ...(cta.tone === 'success' ? styles.primaryCtaButtonSuccess : {}),
          ...(cta.tone === 'neutral' ? styles.primaryCtaButtonNeutral : {}),
          opacity: cta.disabled ? 0.55 : 1,
          cursor: cta.disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {cta.label}
      </button>
    </div>
  );
}
