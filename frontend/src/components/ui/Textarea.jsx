export default function Textarea({ className = '', error, ...props }) {
  return (
    <textarea
      className={`w-full rounded-[var(--radius-sm)] border bg-white px-2.5 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] ${error ? 'border-red-400' : 'border-[var(--color-border-strong)]'} ${className}`}
      {...props}
    />
  );
}
