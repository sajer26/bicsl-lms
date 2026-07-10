import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';
import type { Hospital, Profile } from '@/lib/types';

interface LearnerRow extends Profile {
  hospital_name?: string;
  completedModules: number;
  hasCertificate: boolean;
}

export default function LearnersManagement() {
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: profiles }, { data: hospitalData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'learner').order('full_name'),
      supabase.from('hospitals').select('id, name, code, status'),
    ]);

    const hospitalsById = Object.fromEntries((hospitalData ?? []).map((h) => [h.id, h.name]));
    setHospitals((hospitalData as Hospital[]) ?? []);

    const rows: LearnerRow[] = [];
    for (const p of (profiles as Profile[]) ?? []) {
      const { count: completed } = await supabase
        .from('learner_progress')
        .select('*', { count: 'exact', head: true })
        .eq('learner_id', p.id)
        .eq('is_completed', true);
      const { count: cert } = await supabase
        .from('certificates')
        .select('*', { count: 'exact', head: true })
        .eq('learner_id', p.id);
      rows.push({
        ...p,
        hospital_name: p.hospital_id ? hospitalsById[p.hospital_id] : undefined,
        completedModules: completed ?? 0,
        hasCertificate: (cert ?? 0) > 0,
      });
    }
    setLearners(rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleStatus(l: LearnerRow) {
    const newStatus = l.status === 'active' ? 'disabled' : 'active';
    await supabase.from('profiles').update({ status: newStatus }).eq('id', l.id);
    logAudit('user.status_change', 'profiles', l.id, { newStatus });
    load();
  }

  async function resetProgress(l: LearnerRow) {
    if (!confirm(`Reset all progress for ${l.full_name}? This cannot be undone.`)) return;
    await supabase.from('learner_progress').delete().eq('learner_id', l.id);
    await supabase.from('quiz_attempts').delete().eq('learner_id', l.id);
    await supabase.from('badges').delete().eq('learner_id', l.id);
    await supabase.from('certificates').delete().eq('learner_id', l.id);
    logAudit('user.progress_reset', 'profiles', l.id);
    load();
  }

  function exportCsv() {
    const header = ['Full Name', 'National ID', 'Hospital', 'Status', 'Completed Modules', 'Certificate'];
    const lines = filtered.map((l) =>
      [l.full_name, l.national_id ?? '', l.hospital_name ?? '', l.status, l.completedModules, l.hasCertificate ? 'Issued' : ''].join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learners-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = learners.filter((l) => {
    const matchesSearch =
      !search ||
      l.full_name.toLowerCase().includes(search.toLowerCase()) ||
      l.national_id?.toLowerCase().includes(search.toLowerCase());
    const matchesHospital = !hospitalFilter || l.hospital_id === hospitalFilter;
    return matchesSearch && matchesHospital;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-brand-800">Learners</h1>
        <button onClick={exportCsv} className="btn-secondary">
          Export CSV
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          placeholder="Search by name or National ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-brand-200 rounded-control px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={hospitalFilter}
          onChange={(e) => setHospitalFilter(e.target.value)}
          className="border border-brand-200 rounded-control px-3 py-2 text-sm"
        >
          <option value="">All Hospitals</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700 text-left">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">National ID</th>
              <th className="px-4 py-2">Hospital</th>
              <th className="px-4 py-2">Progress</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-ink/50">
                  Loading...
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="border-t border-brand-50">
                  <td className="px-4 py-2">{l.full_name}</td>
                  <td className="px-4 py-2 text-ink/60">{l.national_id}</td>
                  <td className="px-4 py-2 text-ink/60">{l.hospital_name}</td>
                  <td className="px-4 py-2">
                    {l.completedModules}/7 {l.hasCertificate && <span className="text-success">✓ Certified</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        l.status === 'active' ? 'bg-success-bg text-success' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 rtl:space-x-reverse whitespace-nowrap">
                    <button onClick={() => toggleStatus(l)} className="text-brand-600 hover:underline text-xs">
                      {l.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => resetProgress(l)} className="text-error hover:underline text-xs">
                      Reset Progress
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
