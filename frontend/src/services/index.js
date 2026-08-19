import api from './api';

export const authService = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const dashboardService = {
  stats: () => api.get('/dashboard/stats'),
};

export const hierarchyTypeService = {
  list: (params) => api.get('/hierarchy-types', { params }),
  get: (id) => api.get(`/hierarchy-types/${id}`),
  create: (data) => api.post('/hierarchy-types', data),
  update: (id, data) => api.put(`/hierarchy-types/${id}`, data),
  delete: (id) => api.delete(`/hierarchy-types/${id}`),
};

export const hierarchyService = {
  list: (params) => api.get('/hierarchies', { params }),
  get: (id) => api.get(`/hierarchies/${id}`),
  detail: (id) => api.get(`/hierarchies/${id}/detail`),
  create: (data) => api.post('/hierarchies', data),
  update: (id, data) => api.put(`/hierarchies/${id}`, data),
  delete: (id) => api.delete(`/hierarchies/${id}`),
  effectiveVersion: (id, businessDate) => api.get(`/hierarchies/${id}/versions/effective`, { params: { business_date: businessDate } }),
};

export const nodeTypeService = {
  list: (params) => api.get('/node-types', { params }),
  create: (data) => api.post('/node-types', data),
  update: (id, data) => api.put(`/node-types/${id}`, data),
  delete: (id) => api.delete(`/node-types/${id}`),
  reorder: (items) => api.post('/node-types/reorder', items),
};

export const propertyService = {
  list: (params) => api.get('/property-definitions', { params }),
  create: (data) => api.post('/property-definitions', data),
  update: (id, data) => api.put(`/property-definitions/${id}`, data),
  delete: (id) => api.delete(`/property-definitions/${id}`),
};

export const structuralRuleService = {
  list: (params) => api.get('/structural-rules', { params }),
  create: (data) => api.post('/structural-rules', data),
  update: (id, data) => api.put(`/structural-rules/${id}`, data),
  delete: (id) => api.delete(`/structural-rules/${id}`),
};

export const versionService = {
  list: (params) => api.get('/versions', { params }),
  get: (id) => api.get(`/versions/${id}`),
  create: (hierarchyId, data) => api.post(`/hierarchies/${hierarchyId}/versions`, data),
  copy: (id, data) => api.post(`/versions/${id}/copy`, data),
  update: (id, data) => api.patch(`/versions/${id}`, data),
  cancel: (id) => api.post(`/versions/${id}/cancel`),
  returnToDraft: (id) => api.post(`/versions/${id}/return-to-draft`),
  activate: (id, data) => api.post(`/versions/${id}/activate`, data),
  validate: (id) => api.post(`/versions/${id}/validate`),
  submit: (id, data) => api.post(`/versions/${id}/submit`, data),
  compare: (id, otherId) => api.get(`/versions/${id}/compare/${otherId}`),
  tree: (id) => api.get(`/versions/${id}/tree`),
  allowedChildTypes: (id, parentId) => api.get(`/versions/${id}/allowed-child-types`, { params: { parent_version_node_id: parentId } }),
  addNode: (id, data) => api.post(`/versions/${id}/nodes`, data),
  updateNode: (id, nodeId, data) => api.patch(`/versions/${id}/nodes/${nodeId}`, data),
  deleteNode: (id, nodeId) => api.delete(`/versions/${id}/nodes/${nodeId}`),
  moveNode: (id, nodeId, data) => api.post(`/versions/${id}/nodes/${nodeId}/move`, data),
  cloneNode: (id, nodeId, data) => api.post(`/versions/${id}/nodes/${nodeId}/clone`, data),
  conflicts: (id) => api.get(`/versions/${id}/conflicts`),
  resolveConflicts: (id, resolutions) => api.post(`/versions/${id}/resolve-conflicts`, { resolutions }),
  branchFromNode: (id, nodeId, data) => api.post(`/versions/${id}/nodes/${nodeId}/branch`, data),
  mergeDraft: (id, resolutions = []) => api.post(`/versions/${id}/merge`, { resolutions }),
};

export const approvalService = {
  list: () => api.get('/approval-requests'),
  approve: (requestId, stepId, data) => api.post(`/approval-requests/${requestId}/steps/${stepId}/approve`, data),
  reject: (requestId, stepId, data) => api.post(`/approval-requests/${requestId}/steps/${stepId}/reject`, data),
};

export const governanceService = {
  audit: (params) => api.get('/audit', { params }),
  lineage: (params) => api.get('/lineage', { params }),
};
