import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';

export default function SignIn() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);
    if (signInError) {
      setError('Invalid email or password.');
      return;
    }
    logAudit('user.login');
    navigate('/welcome');
  }

  return (
    <div className="min-h-screen grid place-items-center bg-brand-50 px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-brand-800">{t('landing.signIn')}</h1>

        {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}

        <label className="block text-sm">
          <span className="block mb-1 font-medium">{t('auth.email')}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-brand-200 rounded-control px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </label>

        <label className="block text-sm">
          <span className="block mb-1 font-medium">{t('auth.password')}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-brand-200 rounded-control px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </label>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t('common.loading') : t('auth.signIn')}
        </button>

        <p className="text-sm text-center text-ink/60">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-brand-600 font-medium">
            {t('landing.registerStaff')}
          </Link>
        </p>
      </form>
    </div>
  );
}
