import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';

interface Settings {
  platform_name: string;
  passing_score: number;
  certificate_validity_years: number;
  session_timeout_minutes: number;
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('platform_settings').select('*').eq('id', 1).single().then(({ data }) => setSettings(data));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    await supabase.from('platform_settings').update(settings).eq('id', 1);
    logAudit('settings.update', 'platform_settings', undefined, settings as unknown as Record<string, unknown>);
    setSaving(false);
    setSaved(true);
  }

  if (!settings) return <p className="text-ink/50">Loading...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-bold text-brand-800">Platform Settings</h1>

      <div className="card space-y-4">
        <Field
          label="Platform Name"
          value={settings.platform_name}
          onChange={(v) => setSettings({ ...settings, platform_name: v })}
        />
        <NumField
          label="Passing Score (%)"
          value={settings.passing_score}
          onChange={(v) => setSettings({ ...settings, passing_score: v })}
        />
        <NumField
          label="Certificate Validity (years)"
          value={settings.certificate_validity_years}
          onChange={(v) => setSettings({ ...settings, certificate_validity_years: v })}
        />
        <NumField
          label="Session Timeout (minutes)"
          value={settings.session_timeout_minutes}
          onChange={(v) => setSettings({ ...settings, session_timeout_minutes: v })}
        />

        <p className="text-xs text-ink/50">
          Note: the 80% Post-Quiz pass threshold and 2-year certificate validity are currently
          also hard-coded in the database grading function for security (see
          <code> submit_quiz_attempt()</code>). Changing the values here updates the displayed
          settings; keep them in sync with the SQL function if you change the pass threshold.
        </p>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
          {saved && <span className="text-success text-sm">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-brand-200 rounded-control px-3 py-2"
      />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="block mb-1 font-medium">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-brand-200 rounded-control px-3 py-2"
      />
    </label>
  );
}
