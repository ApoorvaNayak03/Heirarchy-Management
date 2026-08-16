import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import AppLayout from './layouts/AppLayout';
import ApprovalRequestsPage from './pages/ApprovalRequestsPage';
import AuditTrailPage from './pages/AuditTrailPage';
import CompareVersionsPage from './pages/CompareVersionsPage';
import HierarchiesPage from './pages/HierarchiesPage';
import HierarchyBuilderPage from './pages/HierarchyBuilderPage';
import HierarchyTypesPage from './pages/HierarchyTypesPage';
import HierarchyWorkspacePage from './pages/HierarchyWorkspacePage';
import HomePage from './pages/HomePage';
import LineagePage from './pages/LineagePage';
import LoginPage from './pages/LoginPage';
import NewHierarchyPage from './pages/NewHierarchyPage';
import NodeTypesPage from './pages/NodeTypesPage';
import PropertyDefinitionsPage from './pages/PropertyDefinitionsPage';
import SignupPage from './pages/SignupPage';
import StructuralRulesPage from './pages/StructuralRulesPage';
import ValidationPage from './pages/ValidationPage';
import VersionsPage from './pages/VersionsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[13px] text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<HomePage />} />
            <Route path="new" element={<NewHierarchyPage />} />
            <Route path="hierarchy-types" element={<HierarchyTypesPage />} />
            <Route path="hierarchies" element={<HierarchiesPage />} />
            <Route path="hierarchies/:hierarchyId" element={<HierarchyWorkspacePage />} />
            <Route path="hierarchies/:hierarchyId/compare" element={<CompareVersionsPage />} />
            <Route path="versions" element={<VersionsPage />} />
            <Route path="node-types" element={<NodeTypesPage />} />
            <Route path="property-definitions" element={<PropertyDefinitionsPage />} />
            <Route path="structural-rules" element={<StructuralRulesPage />} />
            <Route path="builder" element={<HierarchyBuilderPage />} />
            <Route path="validation" element={<ValidationPage />} />
            <Route path="compare" element={<CompareVersionsPage />} />
            <Route path="approvals" element={<ApprovalRequestsPage />} />
            <Route path="audit" element={<AuditTrailPage />} />
            <Route path="lineage" element={<LineagePage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
