'use client';

import type { CSSProperties } from 'react';
import { WORKFLOW_STEPS, type WorkflowStepId } from './types';

type Props = {
  activeStep: WorkflowStepId;
  completedSteps: Set<WorkflowStepId>;
  hasOrder: boolean;
  styles: Record<string, CSSProperties>;
};

export function StepBar({ activeStep, completedSteps, hasOrder, styles }: Props) {
  return (
    <nav style={styles.stepBar} className="cw-step-bar" aria-label="Kesim iş akışı">
      {WORKFLOW_STEPS.map((step, index) => {
        const isActive = activeStep === step.id;
        const isDone = completedSteps.has(step.id) && !isActive;
        const isLocked = !hasOrder && step.id !== 'select';
        return (
          <div
            key={step.id}
            className={isActive ? 'cw-step-item-active' : undefined}
            style={{
              ...styles.stepItem,
              ...(isActive ? styles.stepItemActive : {}),
              ...(isDone ? styles.stepItemDone : {}),
              ...(isLocked ? styles.stepItemLocked : {}),
            }}
            aria-current={isActive ? 'step' : undefined}
          >
            <span
              style={{
                ...styles.stepIndex,
                ...(isActive ? styles.stepIndexActive : {}),
                ...(isDone ? styles.stepIndexDone : {}),
              }}
            >
              {isDone ? '✓' : index + 1}
            </span>
            <span style={styles.stepLabel}>{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
