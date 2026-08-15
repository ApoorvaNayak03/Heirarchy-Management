export default function Select({ className = '', error, children, ...props }) {
  return (
    <select
      className={`h-8 w-full rounded-[var(--radius-sm)] border bg-white px-2.5 text-[13px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-bg)] ${error ? 'border-red-400' : 'border-[var(--color-border-strong)]'} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
