import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';

export default function SignupPage() {
  const { signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'Business User' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(form);
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Signup failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'username', label: 'Username', type: 'text' },
    { key: 'display_name', label: 'Display name', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'password', label: 'Password', type: 'password' },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h1 className="text-base font-semibold text-[var(--color-text)]">Create account</h1>
        <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">Register to manage hierarchy master data</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {fields.map(({ key, label, type }) => (
            <FormField key={key} label={label}>
              <Input
                type={type}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </FormField>
          ))}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Creating...' : 'Create account'}</Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-[var(--color-text-muted)]">
          <Link to="/login" className="text-[var(--color-accent)] hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
