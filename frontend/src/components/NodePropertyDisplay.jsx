import { Sigma } from 'lucide-react';
import { formatPropertyValue, getCustomPropertyEntries } from '../utils/nodeProperties';

/** Build display rows for a node's saved + computed properties. */
export function getNodePropertyDisplayItems(node, propertyDefs = []) {
  const props = node?.properties || {};
  const items = [];

  propertyDefs.forEach((def) => {
    const raw = props[def.property_code];
    const isRollup = def.data_type === 'ROLLUP';

    if (isRollup) {
      items.push({
        key: def.property_code,
        label: def.display_label,
        value: formatPropertyValue(raw ?? 0),
        isRollup: true,
        aggregation: def.rollup_aggregation || 'SUM',
        source: def.rollup_source_property_code,
      });
      return;
    }

    if (raw === null || raw === undefined || raw === '') return;
    items.push({
      key: def.property_code,
      label: def.display_label,
      value: formatPropertyValue(raw),
      isRollup: false,
    });
  });

  getCustomPropertyEntries(props, propertyDefs).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    items.push({
      key,
      label: key.replace(/_/g, ' '),
      value: formatPropertyValue(value),
      isRollup: false,
      isCustom: true,
    });
  });

  return items;
}

function TreeMetaChip({ item }) {
  if (item.isRollup) {
    return (
      <span
        title={`${item.label} · ${item.aggregation}(${item.source})`}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800"
      >
        <Sigma size={9} />
        <span className="max-w-[80px] truncate">{item.label}</span>
        <span className="font-semibold">{item.value}</span>
      </span>
    );
  }

  return (
    <span
      title={`${item.label}: ${item.value}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
        item.isCustom
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span className="max-w-[64px] truncate opacity-70">{item.label}</span>
      <span className="font-semibold">{item.value}</span>
    </span>
  );
}

/** Compact inline chips for tree rows — max 2 visible + overflow count. */
export function NodeTreeMeta({ node, propertyDefs = [], maxVisible = 2 }) {
  const items = getNodePropertyDisplayItems(node, propertyDefs);
  if (!items.length) return null;

  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1">
      {visible.map((item) => (
        <TreeMetaChip key={item.key} item={item} />
      ))}
      {overflow > 0 && (
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          +{overflow}
        </span>
      )}
    </span>
  );
}

function DetailRow({ label, value, rollup, aggregation, source }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 ${rollup ? 'bg-violet-50/80' : 'bg-[var(--color-bg)]'}`}>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {rollup && <Sigma size={10} className="text-violet-600" />}
        {label}
      </div>
      <div className="text-sm font-semibold text-[var(--color-text)]">{value}</div>
      {rollup && source && (
        <div className="text-[10px] text-violet-700/70">{aggregation} of {source}</div>
      )}
    </div>
  );
}

/** Full property grid for inspector / modal read-only sections. */
export default function NodePropertyDisplay({
  node,
  propertyDefs = [],
  variant = 'detail',
  className = '',
}) {
  const items = getNodePropertyDisplayItems(node, propertyDefs);
  if (!items.length) return null;

  if (variant === 'tree') {
    return <NodeTreeMeta node={node} propertyDefs={propertyDefs} />;
  }

  const rollupItems = items.filter((i) => i.isRollup);
  const fieldItems = items.filter((i) => !i.isRollup);

  return (
    <div className={className}>
      {fieldItems.length > 0 && (
        <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fieldItems.map((item) => (
            <DetailRow key={item.key} label={item.label} value={item.value} />
          ))}
        </div>
      )}
      {rollupItems.length > 0 && (
        <div>
          {rollupItems.length > 1 && (
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
              Rollup summary
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rollupItems.map((item) => (
              <DetailRow
                key={item.key}
                label={item.label}
                value={item.value}
                rollup
                aggregation={item.aggregation}
                source={item.source}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
