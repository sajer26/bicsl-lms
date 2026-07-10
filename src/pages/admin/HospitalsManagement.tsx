import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';
import type { Hospital } from '@/lib/types';

export default function HospitalsManagement() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Hospital | null>(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('hospitals').select('*').order('name');
    setHospitals((data as Hospital[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', code: '' });
    setError(null);
    setShowForm(true);
  }

  function openEdit(h: Hospital) {
    setEditing(h);
    setForm({ name: h.name, code: h.code });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (editing) {
      const { error: updateError } = await supabase
        .from('hospitals')
        .update({ name: form.name, code: form.code })
        .eq('id', editing.id);
      if (updateError) return setError(updateError.message);
      logAudit('hospital.update', 'hospitals', editing.id, { name: form.name });
    } else {
      const { data: created, error: insertError } = await supabase
        .from('hospitals')
        .insert({ name: form.name, code: form.code })
        .select()
        .single();
      if (insertError) return setError(insertError.message);
      logAudit('hospital.create', 'hospitals', created?.id, { name: form.name });
    }

    setShowForm(false);
    load();
  }

  async function toggleStatus(h: Hospital) {
    const newStatus = h.status === 'active' ? 'disabled' : 'active';
    await supabase.from('hospitals').update({ status: newStatus }).eq('id', h.id);
    logAudit('hospital.status_change', 'hospitals', h.id, { newStatus });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-800">Hospitals</h1>
        <button onClick={openCreate} className="btn-primary">
          + Add Hospital
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-3 max-w-md">
          <h2 className="font-semibold">{editing ? 'Edit Hospital' : 'New Hospital'}</h2>
          {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}
          <label className="block text-sm">
            <span className="block mb-1 font-medium">Hospital Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-brand-200 rounded-control px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 font-medium">Hospital Code</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full border border-brand-200 rounded-control px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Save
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-ink/50">Loading...</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-50 text-brand-700 text-left">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} className="border-t border-brand-50">
                  <td className="px-4 py-2">{h.name}</td>
                  <td className="px-4 py-2 text-ink/60">{h.code}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        h.status === 'active' ? 'bg-success-bg text-success' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2 rtl:space-x-reverse">
                    <button onClick={() => openEdit(h)} className="text-brand-600 hover:underline text-xs">
                      Edit
                    </button>
                    <button onClick={() => toggleStatus(h)} className="text-error hover:underline text-xs">
                      {h.status === 'active' ? 'Disable' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
