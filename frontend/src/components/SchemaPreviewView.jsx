import { GitBranch, Layers, Network, TreePine } from 'lucide-react';
import StatusBadge from './StatusBadge';

const TYPE_COLORS = [
  'border-blue-200 bg-blue-50 text-blue-800',
  'border-emerald-200 bg-emerald-50 text-emerald-800',
  'border-violet-200 bg-violet-50 text-violet-800',
  'border-amber-200 bg-amber-50 text-amber-800',
  'border-rose-200 bg-rose-50 text-rose-800',
  'border-cyan-200 bg-cyan-50 text-cyan-800',
];

function colorClass(index) {
  return TYPE_COLORS[index % TYPE_COLORS.length];
}

export default function WorkflowSplitLayout({ formPanel, previewPanel, className = '' }) {
  return (
    <div className={`-mx-2 grid gap-4 px-2 xl:grid-cols-2 xl:gap-5 xl:px-8 ${className}`}>
      <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        {formPanel}
      </section>
      <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        {previewPanel}
      </section>
    </div>
  );
}

export function PreviewPanelHeader({ title, description, badge }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {description && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>}
        </div>
        {badge}
      </div>
    </div>
  );
}

export function FormPanelHeader({ title, description, actions }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {description && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function NodeTypeLadderPreview({ nodeTypes }) {
  if (!nodeTypes.length) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">No node types yet</div>
        <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
          Start typing in the form — your hierarchy levels will appear here instantly.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-0">
        {nodeTypes.map((type, idx) => (
          <div key={type.node_type_id} className="flex flex-col items-center">
            <div
              className={`w-full rounded-lg border-2 px-4 py-3 text-center transition-all ${
                type.isDraft
                  ? 'border-dashed border-blue-300 bg-blue-50/80'
                  : `${colorClass(idx)} shadow-sm`
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                Level {type.display_order}
                {type.isDraft && ' · Preview'}
              </div>
              <div className="mt-1 text-sm font-semibold">{type.name}</div>
              <div className="mt-0.5 font-mono text-[11px] opacity-70">{type.code}</div>
              {type.description && (
                <div className="mt-1 text-[11px] opacity-80">{type.description}</div>
              )}
            </div>
            {idx < nodeTypes.length - 1 && (
              <div className="flex flex-col items-center py-1 text-[var(--color-text-muted)]">
                <div className="h-4 w-px bg-[var(--color-border-strong)]" />
                <div className="text-[10px]">↓ can contain ↓</div>
                <div className="h-4 w-px bg-[var(--color-border-strong)]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PropertySchemaPreview({ nodeTypesWithProperties }) {
  if (!nodeTypesWithProperties.length) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">No node types to preview</div>
        <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
          Complete Step 2 first, then add properties — they will show up here live.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[420px] space-y-3 overflow-y-auto p-4">
      {nodeTypesWithProperties.map((type, idx) => (
        <div
          key={type.node_type_id}
          className={`rounded-lg border p-3 ${colorClass(idx)}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{type.name}</div>
              <div className="font-mono text-[11px] opacity-70">{type.code}</div>
            </div>
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
              {type.properties.length} {type.properties.length === 1 ? 'property' : 'properties'}
            </span>
          </div>
          {type.properties.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {type.properties.map((prop) => (
                <span
                  key={prop.property_definition_id}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${
                    prop.isDraft
                      ? 'border-dashed border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-black/10 bg-white/80'
                  }`}
                >
                  <span className="font-medium">{prop.display_label}</span>
                  <span className="opacity-60">({prop.data_type})</span>
                  {prop.required && <span className="text-red-500">*</span>}
                  {prop.isDraft && <span className="text-blue-600">preview</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] opacity-70">No properties yet</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function HierarchyTypePreview({ data, mode, workflowSteps, currentStep = 1 }) {
  const hasContent = data?.code?.trim() || data?.name?.trim();
  const isDraft = mode === 'create' && hasContent;
  const isEmpty = (mode === 'create' && !hasContent) || (mode === 'existing' && !hasContent);
  const isExisting = mode === 'existing' && hasContent;

  if (isEmpty) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-muted)]">
          <Layers size={22} className="text-[var(--color-accent)]" />
        </div>
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">
          {mode === 'existing' ? 'Select a hierarchy type' : 'Your hierarchy blueprint'}
        </div>
        <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
          {mode === 'existing'
            ? 'Pick an existing template on the left to preview its structure here.'
            : 'Start typing on the left — name, code, and structure settings will appear here instantly.'}
        </p>
      </div>
    );
  }

  const displayName = data.name?.trim() || 'Hierarchy Name';
  const displayCode = data.code?.trim() || 'CODE';

  return (
    <div className="min-h-[420px] space-y-4 overflow-y-auto p-4">
      <div
        className={`rounded-xl border-2 p-5 transition-all ${
          isDraft
            ? 'border-dashed border-blue-300 bg-blue-50/50'
            : isExisting
              ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
              : 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]/40'
        }`}
      >
        {isDraft && (
          <div className="mb-3 inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
            Live preview
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {displayCode}
            </div>
            <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{displayName}</h3>
            {data.description?.trim() && (
              <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">{data.description}</p>
            )}
          </div>
          <StatusBadge status={data.status || 'ACTIVE'} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Structure</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              {data.allow_multiple_parents ? (
                <>
                  <Network size={14} className="text-violet-600" />
                  DAG — multiple parents
                </>
              ) : (
                <>
                  <TreePine size={14} className="text-emerald-600" />
                  Tree — single parent
                </>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Mode</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <GitBranch size={14} className="text-[var(--color-accent)]" />
              {isExisting ? 'Existing template' : 'New template'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Structure preview
        </div>
        {data.allow_multiple_parents ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex gap-8">
              <StructureNode label="Parent A" muted />
              <StructureNode label="Parent B" muted />
            </div>
            <div className="flex gap-8 text-[var(--color-text-muted)]">
              <span className="text-lg">↘</span>
              <span className="text-lg">↙</span>
            </div>
            <StructureNode label={displayName || 'Shared child'} accent />
            <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">
              Nodes can have more than one parent
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <StructureNode label={`${displayCode || 'Root'} level`} accent />
            <div className="text-[var(--color-text-muted)]">↓</div>
            <StructureNode label="Child level" muted />
            <div className="text-[var(--color-text-muted)]">↓</div>
            <StructureNode label="Leaf level" muted />
            <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">
              Each node has exactly one parent
            </p>
          </div>
        )}
      </div>

      {workflowSteps && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Workflow roadmap
          </div>
          <div className="space-y-1.5">
            {workflowSteps.slice(0, 6).map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ${
                  step.id === currentStep
                    ? 'bg-[var(--color-accent-muted)] font-medium text-[var(--color-accent)]'
                    : step.id < currentStep
                      ? 'text-[var(--color-text-secondary)]'
                      : 'text-[var(--color-text-muted)]'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  step.id === currentStep
                    ? 'bg-[var(--color-accent)] text-white'
                    : step.id < currentStep
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
                }`}
                >
                  {step.id}
                </span>
                {step.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StructureNode({ label, accent, muted }) {
  return (
    <div
      className={`rounded-lg border px-4 py-2 text-center text-[12px] font-medium ${
        accent
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
          : muted
            ? 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]'
            : 'border-[var(--color-border)] bg-white'
      }`}
    >
      {label}
    </div>
  );
}

export function VersionPreview({ form, hierarchyCreated, versionCreated }) {
  const hasHierarchy = form.hierarchy_name?.trim() || form.hierarchy_code?.trim();
  const hasVersion = form.version_no?.trim() || form.version_name?.trim();
  const isEmpty = !hasHierarchy && !hasVersion;

  if (isEmpty && !hierarchyCreated) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">Instance preview</div>
        <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
          Fill in hierarchy and version details — the preview updates as you type.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[420px] space-y-4 overflow-y-auto p-4">
      <div className={`rounded-xl border-2 p-4 ${hierarchyCreated ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-blue-300 bg-blue-50/40'}`}>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Hierarchy instance
          {!hierarchyCreated && hasHierarchy && ' · Preview'}
          {hierarchyCreated && ' · Created'}
        </div>
        <div className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
          {form.hierarchy_code?.trim() || 'HIERARCHY_CODE'}
        </div>
        <div className="mt-0.5 text-base font-semibold">{form.hierarchy_name?.trim() || 'Hierarchy Name'}</div>
        {form.hierarchy_description?.trim() && (
          <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{form.hierarchy_description}</p>
        )}
      </div>

      <div className="flex justify-center text-[var(--color-text-muted)]">↓ contains ↓</div>

      <div className={`rounded-xl border-2 p-4 ${versionCreated ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-blue-300 bg-blue-50/40'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Version {form.version_no?.trim() || '1.0'}
              {!versionCreated && hasVersion && ' · Preview'}
            </div>
            <div className="mt-1 text-base font-semibold">{form.version_name?.trim() || 'Initial Version'}</div>
          </div>
          <StatusBadge status="DRAFT" />
        </div>
        {form.valid_from && (
          <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-[12px]">
            <span className="text-[var(--color-text-muted)]">Effective from: </span>
            <span className="font-medium">{form.valid_from}</span>
          </div>
        )}
        {form.description?.trim() && (
          <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">{form.description}</p>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        Next step: build the actual hierarchy tree with nodes in Step 6.
      </div>
    </div>
  );
}
