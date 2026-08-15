import { WORKFLOW_STEPS } from '../../constants/workflow';

export default function StepIndicator({ currentStep, maxCompletedStep, onStepClick }) {
  const maxReachable = Math.max(currentStep, maxCompletedStep + 1);

  return (
    <nav aria-label="Workflow progress" className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto max-w-6xl overflow-x-auto px-4">
        <ol className="flex min-w-max items-center gap-0 py-2">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isCompleted = step.id <= maxCompletedStep;
            const isCurrent = step.id === currentStep;
            const isReachable = step.id <= maxReachable;
            const isClickable = isReachable && step.id !== currentStep;

            return (
              <li key={step.id} className="flex items-center">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(step.id)}
                  className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs transition-colors ${
                    isCurrent
                      ? 'bg-[var(--color-accent-muted)] font-semibold text-[var(--color-accent)]'
                      : isCompleted
                        ? 'text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                        : isReachable
                          ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
                          : 'cursor-not-allowed text-[var(--color-text-muted)]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      isCurrent
                        ? 'bg-[var(--color-accent)] text-white'
                        : isCompleted
                          ? 'bg-[var(--color-text-secondary)] text-white'
                          : 'border border-[var(--color-border-strong)] bg-white text-[var(--color-text-muted)]'
                    }`}
                  >
                    {step.id}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <span className="mx-0.5 text-[var(--color-text-muted)]" aria-hidden="true">→</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
