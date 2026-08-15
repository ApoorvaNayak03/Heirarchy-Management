import { ChevronDown, Circle, Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import './compare.css';

function CompareTreeNode({ node, level, allExpanded, isLast }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children?.length > 0;

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
        className={`compare-row ${hasChildren ? 'compare-row--has-children' : ''}`}
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
      </div>

      {expanded && hasChildren && node.children.map((child, idx, arr) => (
        <CompareTreeNode
          key={child.version_node_id}
          node={child}
          level={level + 1}
          allExpanded={allExpanded}
          isLast={idx === arr.length - 1}
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
}) {
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
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
