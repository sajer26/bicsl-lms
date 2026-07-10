import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { AppHeader } from '@/components/layout/AppHeader';

interface LearnerRow {
  id: string;
  full_name: string;
  national_id: string | null;
  status: string;
  completedModules: number;
  totalModules: number;
  hasCertificate: boolean;
}

export default function HospitalAdminDashboard() {
  const { profile } = useAuth();
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [totalModules, setTotalModules] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.hospital_id) return;

    async function load() {
      const { count: moduleCount } = await supabase
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');
      setTotalModules(moduleCount ?? 0);

      const { data: hospitalLearners } = await supabase
        .from('profiles')
        .select('id, full_name, national_id, status')
        .eq('hospital_id', profile!.hospital_id)
        .eq('role', 'learner');

      const rows: LearnerRow[] = [];
      for (const l of hospitalLearners ?? []) {
        const { count: completed } = await supabase
          .from('learner_progress')
          .select('*', { count: 'exact', head: true })
          .eq('learner_id', l.id)
          .eq('is_completed', true);
        const { count: cert } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('learner_id', l.id);
        rows.push({
          ...l,
          completedModules: completed ?? 0,
          totalModules: moduleCount ?? 0,
          hasCertificate: (cert ?? 0) > 0,
        });
      }
      setLearners(rows);
      setLoading(false);
    }
    load();
  }, [profile]);

  const totalLearners = learners.length;
  const completedLearners = learners.filter((l) => l.hasCertificate).length;
  const activeLearners = learners.filter((l) => l.completedModules > 0 && !l.hasCertificate).length;
  const completionRate = totalLearners ? Math.round((completedLearners / totalLearners) * 100) : 0;

  function exportCsv() {
    const header = ['Name', 'National ID', 'Progress', 'Certificate'];
    const lines = learners.map((l) =>
      [l.full_name, l.national_id ?? '', `${l.completedModules}/${totalModules}`, l.hasCertificate ? 'Issued' : ''].join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hospital-learner-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand-800">Hospital Dashboard</h1>
          <button onClick={exportCsv} className="btn-secondary">
            Export CSV
          </button>
        </div>

        <div className="grid sm:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-ink/50">Total Learners</p>
            <p className="text-2xl font-bold text-brand-700">{totalLearners}</p>
          </div>
          <div className="card">
            <p className="text-sm text-ink/50">Active Learners</p>
            <p className="text-2xl font-bold text-brand-700">{activeLearners}</p>
          </div>
          <div className="card">
            <p className="text-sm text-ink/50">Completed Learners</p>
            <p className="text-2xl font-bold text-brand-700">{completedLearners}</p>
          </div>
          <div className="card">
            <p className="text-sm text-ink/50">Completion Rate</p>
            <p className="text-2xl font-bold text-brand-700">{completionRate}%</p>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-brand-700 text-left">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">National ID</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-ink/50">
                    Loading...
                  </td>
                </tr>
              ) : (
                learners.map((l) => (
                  <tr key={l.id} className="border-t border-brand-50">
                    <td className="px-4 py-2">{l.full_name}</td>
                    <td className="px-4 py-2 text-ink/60">{l.national_id}</td>
                    <td className="px-4 py-2">
                      {l.completedModules}/{totalModules || l.totalModules}
                    </td>
                    <td className="px-4 py-2">
                      {l.hasCertificate ? (
                        <span className="text-success font-medium">Issued</span>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
