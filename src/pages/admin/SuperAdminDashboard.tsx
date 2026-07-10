import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SuperAdminDashboard() {
  const [counts, setCounts] = useState({
    hospitals: 0,
    learners: 0,
    certificates: 0,
  });

  useEffect(() => {
    async function load() {
      const [{ count: hospitals }, { count: learners }, { count: certificates }] = await Promise.all([
        supabase.from('hospitals').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'learner'),
        supabase.from('certificates').select('*', { count: 'exact', head: true }),
      ]);
      setCounts({
        hospitals: hospitals ?? 0,
        learners: learners ?? 0,
        certificates: certificates ?? 0,
      });
    }
    load();
  }, []);

  const cards = [
    { label: 'Total Hospitals', value: counts.hospitals },
    { label: 'Total Learners', value: counts.learners },
    { label: 'Certificates Issued', value: counts.certificates },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-brand-800">Super Admin Dashboard</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-sm text-ink/50">{c.label}</p>
            <p className="text-2xl font-bold text-brand-700">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
