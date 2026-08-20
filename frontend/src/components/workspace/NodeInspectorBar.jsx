import { Edit, X } from 'lucide-react';
import NodePropertyDisplay, { getNodePropertyDisplayItems } from '../NodePropertyDisplay';
import Button from '../ui/Button';

export default function NodeInspectorBar({
  node,
  propertyDefs,
  readOnly,
  onEdit,
  onClear,
}) {
  if (!node) return null;

  const items = getNodePropertyDisplayItems(node, propertyDefs);
  const hasMeta = items.length > 0;

  return (
    <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{node.display_name}</h3>
            <span className="shrink-0 rounded-full bg-[var(--color-accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              {node.node_type_name}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {hasMeta ? 'Fields and rollups for this node' : 'No fields set — click Edit to add properties'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!readOnly && (
            <Button size="sm" variant="secondary" onClick={() => onEdit?.(node)}>
              <Edit size={13} /> Edit
            </Button>
          )}
          <button
            type="button"
            onClick={onClear}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
            aria-label="Close inspector"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {hasMeta && (
        <NodePropertyDisplay
          node={node}
          propertyDefs={propertyDefs}
          variant="detail"
        />
      )}
    </div>
  );
}
