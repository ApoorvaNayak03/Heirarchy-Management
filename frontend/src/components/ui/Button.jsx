const variants = {
  primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] border border-transparent',
  secondary: 'bg-white text-[var(--color-text)] border border-[var(--color-border-strong)] hover:bg-[var(--color-bg)]',
  ghost: 'bg-transparent text-[var(--color-text-secondary)] border border-transparent hover:bg-[var(--color-bg)]',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent',
};

const sizes = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-4 text-[13px]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
