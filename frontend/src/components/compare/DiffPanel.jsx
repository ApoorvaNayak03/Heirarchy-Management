import { ChevronDown, ChevronRight, Plus, Minus, Edit3, Move, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

const changeTypeIcons = {
  Added: <Plus size={16} className="text-green-600" />,
  Removed: <Minus size={16} className="text-red-600" />,
  Renamed: <Edit3 size={16} className="text-blue-600" />,
  Moved: <Move size={16} className="text-purple-600" />,
  Property: <Edit3 size={16} className="text-orange-600" />,
};

const changeTypeColors = {
  Added: 'bg-green-50 border-green-200',
  Removed: 'bg-red-50 border-red-200',
  Renamed: 'bg-blue-50 border-blue-200',
  Moved: 'bg-purple-50 border-purple-200',
  Property: 'bg-orange-50 border-orange-200',
};

const changeTypeBadgeColors = {
  Added: 'bg-green-100 text-green-800',
  Removed: 'bg-red-100 text-red-800',
  Renamed: 'bg-blue-100 text-blue-800',
  Moved: 'bg-purple-100 text-purple-800',
  Property: 'bg-orange-100 text-orange-800',
};

const CONFLICT_FIELD_LABELS = {
  display_name: 'Name',
  parent: 'Parent',
};

function conflictFieldLabel(field) {
  if (field.startsWith('property:')) return `Property: ${field.slice('property:'.length)}`;
  return CONFLICT_FIELD_LABELS[field] || field;
}

function conflictKey(c) {
  return `${c.hierarchy_node_id}::${c.field}`;
}

function fieldForChangeType(changeType) {
  if (changeType === 'Renamed') return 'display_name';
  if (changeType === 'Moved') return 'parent';
  return null;
}

function conflictsForChange(change, conflictsByNode) {
  const nodeConflicts = conflictsByNode[change.hierarchy_node_id] || [];
  if (!nodeConflicts.length) return [];
  if (change.change_type === 'Property') return nodeConflicts.filter((c) => c.field.startsWith('property:'));
  const field = fieldForChangeType(change.change_type);
  return field ? nodeConflicts.filter((c) => c.field === field) : [];
}

function ConflictBlock({ conflict, choice, onChoiceChange }) {
  const key = conflictKey(conflict);
  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-900">
        <AlertTriangle size={13} /> Conflict — {conflictFieldLabel(conflict.field)} changed on both sides
      </div>
      <div className="mb-2 flex gap-4 text-gray-700">
        <span>Active: <span className="font-mono">{conflict.active_value ?? '—'}</span></span>
        <span>Proposed: <span className="font-mono">{conflict.proposed_value ?? '—'}</span></span>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5">
          <input type="radio" name={key} checked={choice === 'active'} onChange={() => onChoiceChange(key, 'active')} />
          Keep active
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={key} checked={choice !== 'active'} onChange={() => onChoiceChange(key, 'proposed')} />
          Keep proposed
        </label>
      </div>
    </div>
  );
}

function DiffItem({ change, conflicts, choices, onChoiceChange }) {
  const [expanded, setExpanded] = useState(conflicts.length > 0);
  const hasConflict = conflicts.length > 0;

  return (
    <div className={`border-l-4 ${hasConflict ? 'border-l-amber-400' : 'border-l-gray-300'} ${changeTypeColors[change.change_type]}`}>
      <div
        className="flex cursor-pointer items-center gap-3 border-b border-gray-200 px-4 py-3 hover:bg-white/50"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex items-center gap-2">
          {changeTypeIcons[change.change_type]}
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${changeTypeBadgeColors[change.change_type]}`}>
            {change.change_type}
          </span>
        </div>

        <span className="font-medium text-gray-900">{change.node}</span>

        {hasConflict && (
          <span className="ml-auto flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <AlertTriangle size={12} /> Conflict
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-gray-200 bg-white/30 px-4 py-3">
          {change.change_type === 'Property' ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-mono text-xs text-gray-600">Property change</span>
              </div>
              <div className="flex gap-4">
                {change.old_value && (
                  <div>
                    <span className="text-xs font-semibold text-red-700">Old:</span>
                    <div className="font-mono rounded bg-red-100/50 px-2 py-1 text-xs text-red-900">
                      {change.old_value}
                    </div>
                  </div>
                )}
                {change.new_value && (
                  <div>
                    <span className="text-xs font-semibold text-green-700">New:</span>
                    <div className="font-mono rounded bg-green-100/50 px-2 py-1 text-xs text-green-900">
                      {change.new_value}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {change.old_value && (
                <div>
                  <span className="text-xs font-semibold text-red-700">Before:</span>
                  <div className="font-mono rounded bg-red-100/50 px-2 py-1 text-xs text-red-900">
                    {change.old_value}
                  </div>
                </div>
              )}
              {change.new_value && (
                <div>
                  <span className="text-xs font-semibold text-green-700">After:</span>
                  <div className="font-mono rounded bg-green-100/50 px-2 py-1 text-xs text-green-900">
                    {change.new_value}
                  </div>
                </div>
              )}
            </div>
          )}

          {conflicts.map((c) => (
            <ConflictBlock
              key={conflictKey(c)}
              conflict={c}
              choice={choices[conflictKey(c)]}
              onChoiceChange={onChoiceChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiffPanel({
  compareResult,
  loading = false,
  conflicts = [],
  conflictsLoading = false,
  onResolveConflicts,
  resolvingConflicts = false,
}) {
  const [choices, setChoices] = useState({});

  useEffect(() => {
    setChoices((prev) => {
      const next = { ...prev };
      conflicts.forEach((c) => {
        const key = conflictKey(c);
        if (!next[key]) next[key] = 'proposed';
      });
      return next;
    });
  }, [conflicts]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Analyzing differences…
      </div>
    );
  }

  if (!compareResult) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Select two versions to compare
      </div>
    );
  }

  const { summary, changes } = compareResult;
  const conflictsByNode = {};
  conflicts.forEach((c) => {
    (conflictsByNode[c.hierarchy_node_id] = conflictsByNode[c.hierarchy_node_id] || []).push(c);
  });

  const handleApply = () => onResolveConflicts(conflicts.map((c) => ({
    hierarchy_node_id: c.hierarchy_node_id,
    field: c.field,
    choice: choices[conflictKey(c)] || 'proposed',
  })));

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50">
      {onResolveConflicts && (conflictsLoading || conflicts.length > 0) && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {conflictsLoading ? (
            <span>Checking for conflicts with the active version…</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 font-medium">
                <AlertTriangle size={15} /> {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} with the active version — resolve below
              </span>
              <button
                type="button"
                disabled={resolvingConflicts}
                onClick={handleApply}
                className="shrink-0 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {resolvingConflicts ? 'Applying…' : 'Apply all resolutions'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">Change Summary</div>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-5">
          {summary.added > 0 && (
            <div className="rounded bg-green-50 px-3 py-2">
              <div className="text-2xl font-bold text-green-700">{summary.added}</div>
              <div className="text-xs text-green-700">Added</div>
            </div>
          )}
          {summary.removed > 0 && (
            <div className="rounded bg-red-50 px-3 py-2">
              <div className="text-2xl font-bold text-red-700">{summary.removed}</div>
              <div className="text-xs text-red-700">Removed</div>
            </div>
          )}
          {summary.renamed > 0 && (
            <div className="rounded bg-blue-50 px-3 py-2">
              <div className="text-2xl font-bold text-blue-700">{summary.renamed}</div>
              <div className="text-xs text-blue-700">Renamed</div>
            </div>
          )}
          {summary.moved > 0 && (
            <div className="rounded bg-purple-50 px-3 py-2">
              <div className="text-2xl font-bold text-purple-700">{summary.moved}</div>
              <div className="text-xs text-purple-700">Moved</div>
            </div>
          )}
          {summary.property_changed > 0 && (
            <div className="rounded bg-orange-50 px-3 py-2">
              <div className="text-2xl font-bold text-orange-700">{summary.property_changed}</div>
              <div className="text-xs text-orange-700">Properties</div>
            </div>
          )}
        </div>
        {changes.length === 0 && (
          <div className="mt-3 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
            ✓ No differences found
          </div>
        )}
      </div>

      {/* Changes list */}
      <div className="flex-1 overflow-y-auto">
        {changes.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {changes.map((change, idx) => (
              <DiffItem
                key={idx}
                change={change}
                conflicts={conflictsForChange(change, conflictsByNode)}
                choices={choices}
                onChoiceChange={(key, value) => setChoices((prev) => ({ ...prev, [key]: value }))}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <span className="text-sm">No changes</span>
          </div>
        )}
      </div>
    </div>
  );
}
