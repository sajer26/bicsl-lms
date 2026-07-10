import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';

/**
 * Isolated from the learner sign-in flow per SRS §16 / Design Spec §16.
 * After password auth succeeds, we additionally verify the profile's role
 * is super_admin before granting access — anyone else is signed back out.
 * This is a UX gate; the real boundary is enforced by RLS on every table.
 */
export default function SuperAdminSignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setSubmitting(false);
      setError('Invalid credentials.');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();

    setSubmitting(false);

    if (profile?.role !== 'super_admin') {
      await supabase.auth.signOut();
      setError('This portal is restricted to Super Administrators.');
      return;
    }

    navigate('/admin');
    logAudit('user.login', undefined, undefined, { portal: 'super_admin' });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-brand-900 px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 bg-white">
        <h1 className="text-xl font-bold text-brand-800">Super Admin Login</h1>
        <p className="text-sm text-ink/60">Restricted administrative access.</p>

        {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}

        <label className="block text-sm">
          <span className="block mb-1 font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-brand-200 rounded-control px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="block mb-1 font-medium">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-brand-200 rounded-control px-3 py-2"
          />
        </label>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Verifying...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
