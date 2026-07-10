import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';
import type { Hospital } from '@/lib/types';

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    nationalId: '',
    dateOfBirth: '',
    email: '',
    password: '',
    hospitalId: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('hospitals')
      .select('id, name, code, status')
      .eq('status', 'active')
      .then(({ data }) => setHospitals((data as Hospital[]) ?? []));
  }, []);

  function updateField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.fullName || !form.nationalId || !form.dateOfBirth || !form.email || !form.password || !form.hospitalId) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the auth account (email + password)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Registration failed. Please try again.');

      // 2. Create the profile row (RLS: a user may only insert their own profile
      // via a matching id — enforce this with an insert policy or, more safely,
      // a Postgres trigger on auth.users that auto-creates the profile row).
      const { error: profileError } = await supabase.from('profiles').insert({
        id: signUpData.user.id,
        full_name: form.fullName,
        national_id: form.nationalId,
        date_of_birth: form.dateOfBirth,
        hospital_id: form.hospitalId,
        role: 'learner',
      });
      if (profileError) throw profileError;

      logAudit('user.register', 'profiles', signUpData.user.id);
      navigate('/welcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-brand-50 px-4 py-10">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-brand-800">{t('landing.registerStaff')}</h1>

        {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}

        <Field label={t('auth.fullName')} value={form.fullName} onChange={(v) => updateField('fullName', v)} required />
        <Field label={t('auth.nationalId')} value={form.nationalId} onChange={(v) => updateField('nationalId', v)} required />
        <Field
          label={t('auth.dateOfBirth')}
          type="date"
          value={form.dateOfBirth}
          onChange={(v) => updateField('dateOfBirth', v)}
          required
        />
        <Field label={t('auth.email')} type="email" value={form.email} onChange={(v) => updateField('email', v)} required />
        <Field
          label={t('auth.password')}
          type="password"
          value={form.password}
          onChange={(v) => updateField('password', v)}
          required
        />

        <label className="block text-sm">
          <span className="block mb-1 font-medium text-ink">{t('auth.hospital')}</span>
          <select
            className="w-full border border-brand-200 rounded-control px-3 py-2"
            value={form.hospitalId}
            onChange={(e) => updateField('hospitalId', e.target.value)}
            required
          >
            <option value="" disabled>
              —
            </option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t('common.loading') : t('auth.register')}
        </button>

        <p className="text-sm text-center text-ink/60">
          {t('auth.haveAccount')}{' '}
          <Link to="/sign-in" className="text-brand-600 font-medium">
            {t('auth.signIn')}
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium text-ink">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-brand-200 rounded-control px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
    </label>
  );
}
