const TYPE_COLORS = [
  'bg-blue-100 text-blue-700 ring-blue-200/60',
  'bg-emerald-100 text-emerald-700 ring-emerald-200/60',
  'bg-violet-100 text-violet-700 ring-violet-200/60',
  'bg-amber-100 text-amber-700 ring-amber-200/60',
  'bg-rose-100 text-rose-700 ring-rose-200/60',
  'bg-cyan-100 text-cyan-700 ring-cyan-200/60',
];

export function nodeTypeColorClass(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length];
}

export function countDescendants(node) {
  if (!node?.children?.length) return 0;
  return node.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0,
  );
}
