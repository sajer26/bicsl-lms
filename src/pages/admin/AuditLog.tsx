import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string;
}

export default function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      const logs = (data as AuditRow[]) ?? [];
      const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];

      let namesById: Record<string, string> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', actorIds);
        namesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
      }

      setRows(logs.map((l) => ({ ...l, actor_name: l.actor_id ? namesById[l.actor_id] : 'System' })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter
    ? rows.filter(
        (r) =>
          r.action_type.toLowerCase().includes(filter.toLowerCase()) ||
          r.actor_name?.toLowerCase().includes(filter.toLowerCase())
      )
    : rows;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-800">Audit Log</h1>
        <input
          placeholder="Filter by action or user…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-brand-200 rounded-control px-3 py-2 text-sm w-64"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-brand-700 text-left">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-ink/50">
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-ink/50">
                  No matching entries.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-brand-50">
                  <td className="px-4 py-2 text-ink/60 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{r.actor_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-brand-700">{r.action_type}</td>
                  <td className="px-4 py-2 text-ink/50 text-xs">
                    {r.target_table ? `${r.target_table}${r.target_id ? ` / ${r.target_id.slice(0, 8)}…` : ''}` : '—'}
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
