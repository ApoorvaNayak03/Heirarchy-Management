import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

export default function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h1 className="text-base font-semibold text-[var(--color-text)]">Sign in</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">SCM Hierarchy Management</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <FormField label="Username">
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
          </FormField>
          <FormField label="Password">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
          </FormField>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Signing in...' : 'Sign in'}</Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-[var(--color-text-muted)]">
          No account? <Link to="/signup" className="text-[var(--color-accent)] hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
