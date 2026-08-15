import Button from './Button';

export default function StepNavigation({ onBack, onContinue, continueLabel = 'Continue', backLabel = 'Back', loading, continueDisabled, showBack = true }) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div>
        {showBack && onBack && (
          <Button variant="secondary" onClick={onBack} disabled={loading}>
            {backLabel}
          </Button>
        )}
      </div>
      <div>
        {onContinue && (
          <Button onClick={onContinue} disabled={continueDisabled || loading}>
            {loading ? 'Saving...' : continueLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
