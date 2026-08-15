import { ArrowLeft, ArrowDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SchemaGraphView from '../components/SchemaGraphView';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';
import { useToast } from '../hooks/useToast';
import {
  hierarchyService,
  hierarchyTypeService,
  nodeTypeService,
  structuralRuleService,
  versionService,
} from '../services';

export default function NewHierarchyPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({
    type_code: '',
    type_name: '',
    hierarchy_code: '',
    hierarchy_name: '',
  });
  const [levels, setLevels] = useState([{ code: '', name: '' }]);

  const previewNodeTypes = levels.map((l, i) => ({
    node_type_id: `draft-${i}`,
    code: l.code,
    name: l.name,
    display_order: i + 1,
  }));

  const previewEdges = levels.slice(1).map((_, i) => ({
    id: `draft-edge-${i}`,
    parentId: `draft-${i}`,
    childId: `draft-${i + 1}`,
  }));

  const addLevel = () => {
    const n = levels.length + 1;
    setLevels([...levels, { code: `LEVEL_${n}`, name: `Level ${n}` }]);
  };

  const removeLevel = (idx) => {
    if (levels.length <= 1) return;
    setLevels(levels.filter((_, i) => i !== idx));
  };

  const updateLevel = (idx, field, value) => {
    setLevels(levels.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const handleCreate = async () => {
    if (!meta.type_code.trim() || !meta.hierarchy_code.trim() || !meta.hierarchy_name.trim()) {
      showToast('Fill in all required fields', 'error');
      return;
    }
    if (levels.some((l) => !l.code.trim() || !l.name.trim())) {
      showToast('Fill in code and name for every node type level', 'error');
      return;
    }
    setLoading(true);
    try {
      const typeRes = await hierarchyTypeService.create({
        code: meta.type_code.trim().toUpperCase(),
        name: meta.type_name.trim() || meta.type_code.trim(),
        allow_multiple_parents: false,
      });
      const typeId = typeRes.data.hierarchy_type_id;

      const createdTypes = [];
      for (let i = 0; i < levels.length; i += 1) {
        const res = await nodeTypeService.create({
          hierarchy_type_id: typeId,
          code: levels[i].code.trim().toUpperCase(),
          name: levels[i].name.trim(),
          display_order: i + 1,
        });
        createdTypes.push(res.data);
      }

      for (let i = 1; i < createdTypes.length; i += 1) {
        await structuralRuleService.create({
          hierarchy_type_id: typeId,
          parent_node_type_id: createdTypes[i - 1].node_type_id,
          child_node_type_id: createdTypes[i].node_type_id,
        });
      }

      const hierRes = await hierarchyService.create({
        hierarchy_type_id: typeId,
        code: meta.hierarchy_code.trim().toUpperCase(),
        name: meta.hierarchy_name.trim(),
      });

      await versionService.create(hierRes.data.hierarchy_id, {
        version_no: 'V1',
        version_name: 'Initial Version',
        valid_from: new Date().toISOString().slice(0, 10),
      });

      showToast('Hierarchy created', 'success');
      navigate(`/hierarchies/${hierRes.data.hierarchy_id}`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Creation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-6xl flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-[var(--color-text)]">Create Hierarchy</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Define structure visually — node types chain into your schema graph</p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating…' : 'Create & open workspace'}
        </Button>
      </header>

      <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-5">
        <section className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:col-span-2">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Details</h2>
          </div>
          <div className="space-y-3 overflow-y-auto p-4">
            <FormField label="Type code" required>
              <Input value={meta.type_code} onChange={(e) => setMeta({ ...meta, type_code: e.target.value })} placeholder="HIERARCHY_TYPE" />
            </FormField>
            <FormField label="Type name">
              <Input value={meta.type_name} onChange={(e) => setMeta({ ...meta, type_name: e.target.value })} placeholder="Hierarchy type name" />
            </FormField>
            <FormField label="Hierarchy code" required>
              <Input value={meta.hierarchy_code} onChange={(e) => setMeta({ ...meta, hierarchy_code: e.target.value })} placeholder="MY_HIERARCHY" />
            </FormField>
            <FormField label="Hierarchy name" required>
              <Input value={meta.hierarchy_name} onChange={(e) => setMeta({ ...meta, hierarchy_name: e.target.value })} placeholder="My hierarchy" />
            </FormField>

            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Node type levels</span>
                <button type="button" onClick={addLevel} className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
                  <Plus size={12} /> Add level
                </button>
              </div>
              <div className="space-y-2">
                {levels.map((level, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-muted)] text-[10px] font-bold text-[var(--color-accent)]">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <Input
                        value={level.name}
                        onChange={(e) => updateLevel(idx, 'name', e.target.value)}
                        placeholder="Display name"
                        className="h-7 text-xs"
                      />
                      <Input
                        value={level.code}
                        onChange={(e) => updateLevel(idx, 'code', e.target.value)}
                        placeholder="CODE"
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                    {idx < levels.length - 1 && <ArrowDown size={14} className="shrink-0 text-[var(--color-text-muted)]" />}
                    <button type="button" onClick={() => removeLevel(idx)} className="rounded p-1 text-red-400 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:col-span-3">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-sm font-semibold">Structure preview</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Live graph of your node type chain — each level connects parent → child</p>
          </div>
          <div className="flex-1 p-4">
            <SchemaGraphView nodeTypes={previewNodeTypes} edges={previewEdges} />
          </div>
        </section>
      </div>
    </div>
  );
}
