import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import AppLayout from './layouts/AppLayout';
import CompareVersionsPage from './pages/CompareVersionsPage';
import HierarchyWorkspacePage from './pages/HierarchyWorkspacePage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NewHierarchyPage from './pages/NewHierarchyPage';
import SignupPage from './pages/SignupPage';

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
            <Route path="hierarchies/:hierarchyId" element={<HierarchyWorkspacePage />} />
            <Route path="hierarchies/:hierarchyId/compare" element={<CompareVersionsPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
