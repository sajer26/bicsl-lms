import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Hospital } from '@/lib/types';

interface ReportRow {
  full_name: string;
  national_id: string | null;
  hospital_name: string;
  completedModules: number;
  hasCertificate: boolean;
  bestAverageScore: number | null;
}

export default function Reports() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: hospitalData } = await supabase.from('hospitals').select('id, name, code, status');
      setHospitals((hospitalData as Hospital[]) ?? []);
      const hospitalsById = Object.fromEntries((hospitalData ?? []).map((h) => [h.id, h.name]));

      let query = supabase.from('profiles').select('id, full_name, national_id, hospital_id').eq('role', 'learner');
      if (hospitalFilter) query = query.eq('hospital_id', hospitalFilter);
      const { data: learners } = await query;

      const report: ReportRow[] = [];
      for (const l of learners ?? []) {
        const { count: completed } = await supabase
          .from('learner_progress')
          .select('*', { count: 'exact', head: true })
          .eq('learner_id', l.id)
          .eq('is_completed', true);
        const { count: cert } = await supabase
          .from('certificates')
          .select('*', { count: 'exact', head: true })
          .eq('learner_id', l.id);
        const { data: scores } = await supabase
          .from('learner_progress')
          .select('best_score')
          .eq('learner_id', l.id)
          .not('best_score', 'is', null);

        const avg = scores && scores.length > 0 ? scores.reduce((s, r) => s + (r.best_score ?? 0), 0) / scores.length : null;

        report.push({
          full_name: l.full_name,
          national_id: l.national_id,
          hospital_name: l.hospital_id ? hospitalsById[l.hospital_id] : '',
          completedModules: completed ?? 0,
          hasCertificate: (cert ?? 0) > 0,
          bestAverageScore: avg,
        });
      }
      setRows(report);
      setLoading(false);
    }
    load();
  }, [hospitalFilter]);

  function exportCsv() {
    const header = ['Full Name', 'National ID', 'Hospital', 'Completed Modules', 'Avg Score', 'Certificate'];
    const lines = rows.map((r) =>
      [
        r.full_name,
        r.national_id ?? '',
        r.hospital_name,
        r.completedModules,
        r.bestAverageScore?.toFixed(1) ?? '',
        r.hasCertificate ? 'Issued' : '',
      ].join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bicsl-completion-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pdf.setFontSize(14);
    pdf.text('BICSL Completion Report', 14, 16);
    pdf.setFontSize(9);
    let y = 26;
    pdf.text('Name', 14, y);
    pdf.text('Hospital', 80, y);
    pdf.text('Completed', 140, y);
    pdf.text('Certificate', 170, y);
    y += 6;
    rows.forEach((r) => {
      if (y > 280) {
        pdf.addPage();
        y = 16;
      }
      pdf.text(r.full_name.slice(0, 30), 14, y);
      pdf.text((r.hospital_name ?? '').slice(0, 25), 80, y);
      pdf.text(`${r.completedModules}/7`, 140, y);
      pdf.text(r.hasCertificate ? 'Yes' : 'No', 170, y);
      y += 6;
    });
    pdf.save('bicsl-completion-report.pdf');
  }

  const totalLearners = rows.length;
  const certified = rows.filter((r) => r.hasCertificate).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-brand-800">Reports</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary">
            Export Excel (CSV)
          </button>
          <button onClick={exportPdf} className="btn-primary">
            Export PDF
          </button>
        </div>
      </div>

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

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-ink/50">Learners in Scope</p>
          <p className="text-2xl font-bold text-brand-700">{totalLearners}</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink/50">Certified</p>
          <p className="text-2xl font-bold text-brand-700">{certified}</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink/50">Completion Rate</p>
          <p className="text-2xl font-bold text-brand-700">
            {totalLearners ? Math.round((certified / totalLearners) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700 text-left">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Hospital</th>
              <th className="px-4 py-2">Completed</th>
              <th className="px-4 py-2">Avg Score</th>
              <th className="px-4 py-2">Certificate</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-ink/50">
                  Loading...
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-brand-50">
                  <td className="px-4 py-2">{r.full_name}</td>
                  <td className="px-4 py-2 text-ink/60">{r.hospital_name}</td>
                  <td className="px-4 py-2">{r.completedModules}/7</td>
                  <td className="px-4 py-2">{r.bestAverageScore?.toFixed(1) ?? '—'}</td>
                  <td className="px-4 py-2">{r.hasCertificate ? <span className="text-success">Issued</span> : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
