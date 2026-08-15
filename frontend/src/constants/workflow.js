export const WORKFLOW_STEPS = [
  { id: 1, key: 'type', label: 'Type', title: 'Hierarchy Type', description: 'Define the hierarchy type template and governance rules.' },
  { id: 2, key: 'nodes', label: 'Nodes', title: 'Node Types', description: 'Define node types and their hierarchical order.' },
  { id: 3, key: 'properties', label: 'Properties', title: 'Property Definitions', description: 'Configure properties for each node type.' },
  { id: 4, key: 'rules', label: 'Rules', title: 'Structural Rules', description: 'Define valid parent-child relationships.' },
  { id: 5, key: 'version', label: 'Version', title: 'Create Version', description: 'Create the hierarchy instance and initial version.' },
  { id: 6, key: 'build', label: 'Build', title: 'Build Hierarchy', description: 'Add nodes, configure properties, and establish relationships.' },
  { id: 7, key: 'validate', label: 'Validate', title: 'Validate', description: 'Run structural and property validation checks.' },
  { id: 8, key: 'submit', label: 'Submit', title: 'Submit for Approval', description: 'Submit the version for governance review.' },
  { id: 9, key: 'approve', label: 'Approve', title: 'Approval', description: 'Complete sequential approval steps.' },
  { id: 10, key: 'activate', label: 'Activate', title: 'Activate', description: 'Activate the approved version.' },
];

export const STORAGE_KEY = 'scm_workflow_sessions';

export function createEmptyWorkflow() {
  return {
    id: crypto.randomUUID(),
    currentStep: 1,
    maxCompletedStep: 0,
    hierarchyTypeId: null,
    hierarchyId: null,
    versionId: null,
    versionStatus: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadWorkflowSessions() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWorkflowSessions(sessions) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getWorkflowSession(id) {
  return loadWorkflowSessions().find((s) => s.id === id) || null;
}

export function upsertWorkflowSession(session) {
  const sessions = loadWorkflowSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  const updated = { ...session, updatedAt: new Date().toISOString() };
  if (idx >= 0) sessions[idx] = updated;
  else sessions.unshift(updated);
  saveWorkflowSessions(sessions);
  return updated;
}
