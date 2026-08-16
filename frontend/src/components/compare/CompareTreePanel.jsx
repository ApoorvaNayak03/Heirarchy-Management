import { ChevronDown, Circle, Folder, Plus, Minus, Edit3, Move } from 'lucide-react';
import { useEffect, useState } from 'react';
import './compare.css';

const changeTypeIcons = {
  Added: <Plus size={12} className="text-green-600" />,
  Removed: <Minus size={12} className="text-red-600" />,
  Renamed: <Edit3 size={12} className="text-blue-600" />,
  Moved: <Move size={12} className="text-purple-600" />,
  Property: <Edit3 size={12} className="text-orange-600" />,
};

const changeTypeBg = {
  Added: 'bg-green-50 border-l-4 border-l-green-500',
  Removed: 'bg-red-50 border-l-4 border-l-red-500',
  Renamed: 'bg-blue-50 border-l-4 border-l-blue-500',
  Moved: 'bg-purple-50 border-l-4 border-l-purple-500',
  Property: 'bg-orange-50 border-l-4 border-l-orange-500',
};

function CompareTreeNode({ node, level, allExpanded, isLast, changes }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children?.length > 0;
  const nodeChanges = changes?.[node.hierarchy_node_id] || [];

  useEffect(() => {
    setExpanded(allExpanded);
  }, [allExpanded]);

  return (
    <div className="relative">
      {level > 0 && (
        <>
          <span
            className="compare-tree-line-v"
            style={{ left: `${(level - 1) * 20 + 14}px`, top: 0, bottom: isLast ? '50%' : 0 }}
          />
          <span
            className="compare-tree-line-h"
            style={{ left: `${(level - 1) * 20 + 14}px`, top: '17px', width: '12px' }}
          />
        </>
      )}

      <div
        className={`compare-row ${hasChildren ? 'compare-row--has-children' : ''} ${nodeChanges.length > 0 ? changeTypeBg[nodeChanges[0].change_type] : ''}`}
        style={{ marginLeft: `${level * 20}px` }}
        onClick={hasChildren ? () => setExpanded(!expanded) : undefined}
        onKeyDown={hasChildren ? (e) => e.key === 'Enter' && setExpanded(!expanded) : undefined}
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
      >
        {hasChildren ? (
          <Folder size={15} className="compare-node-icon" />
        ) : (
          <Circle size={5} className="compare-node-icon fill-[#bdc1c6] text-[#bdc1c6]" />
        )}

        <span className="compare-node-name">{node.display_name}</span>
        <span className="compare-node-type">{node.node_type_name}</span>

        {nodeChanges.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5 pr-2">
            {nodeChanges.map((change, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
                title={`${change.change_type}: ${change.old_value || ''} → ${change.new_value || ''}`}
                style={{
                  backgroundColor:
                    change.change_type === 'Added'
                      ? '#dcfce7'
                      : change.change_type === 'Removed'
                        ? '#fee2e2'
                        : change.change_type === 'Renamed'
                          ? '#dbeafe'
                          : change.change_type === 'Moved'
                            ? '#f3e8ff'
                            : '#fed7aa',
                  color:
                    change.change_type === 'Added'
                      ? '#166534'
                      : change.change_type === 'Removed'
                        ? '#991b1b'
                        : change.change_type === 'Renamed'
                          ? '#0c4a6e'
                          : change.change_type === 'Moved'
                            ? '#581c87'
                            : '#b45309',
                }}
              >
                {changeTypeIcons[change.change_type]}
                {change.change_type}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && hasChildren && node.children.map((child, idx, arr) => (
        <CompareTreeNode
          key={child.version_node_id}
          node={child}
          level={level + 1}
          allExpanded={allExpanded}
          isLast={idx === arr.length - 1}
          changes={changes}
        />
      ))}
    </div>
  );
}

export default function CompareTreePanel({
  version,
  tree,
  allExpanded,
  collapsed,
  onToggleCollapse,
  nodeCount,
  changes,
}) {
  const changesByNodeId = changes ? Object.fromEntries(
    changes.map(c => [c.hierarchy_node_id, [...(changes.filter(x => x.hierarchy_node_id === c.hierarchy_node_id))]]).filter((v, i, a) => a.findIndex(t => t[0] === v[0]) === i)
  ) : {};
  const title = version?.version_no || '—';
  const date = version?.valid_from || version?.created_at;

  return (
    <div className="compare-panel flex h-full flex-col">
      <button type="button" onClick={onToggleCollapse} className="compare-panel-header w-full text-left">
        <div>
          <span className="compare-panel-title">{title}</span>
          {date && (
            <span className="compare-panel-date">
              ({new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="compare-panel-count">{nodeCount} nodes</span>
          <ChevronDown size={16} className={`text-[#9aa0a6] transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="compare-tree-body flex-1 overflow-y-auto">
          {!tree?.length ? (
            <p className="py-12 text-center text-xs text-[#9aa0a6]">No nodes</p>
          ) : (
            tree.map((node, idx, arr) => (
              <CompareTreeNode
                key={node.version_node_id}
                node={node}
                level={0}
                allExpanded={allExpanded}
                isLast={idx === arr.length - 1}
                changes={changesByNodeId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
