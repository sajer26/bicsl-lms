import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';
import type { Module } from '@/lib/types';

export default function ModulesManagement() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('modules')
      .select('*')
      .is('deleted_at', null)
      .order('order_index');
    setModules((data as Module[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(m: Module) {
    const newStatus = m.status === 'published' ? 'draft' : 'published';
    await supabase.from('modules').update({ status: newStatus }).eq('id', m.id);
    logAudit(newStatus === 'published' ? 'module.publish' : 'module.unpublish', 'modules', m.id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-brand-800">Modules</h1>
      <p className="text-sm text-ink/60">
        The seven BICSL modules are fixed by the course design. Attach video, resources, and quiz
        questions to each, then publish it so learners can access it.
      </p>

      {loading ? (
        <p className="text-ink/50">Loading...</p>
      ) : (
        <div className="space-y-3">
          {modules.map((m) => (
            <div key={m.id} className="card flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-500 font-medium">{m.module_code}</p>
                <p className="font-semibold">{m.name_en}</p>
                <p className="text-xs text-ink/50">{m.name_ar}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.status === 'published' ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
                  }`}
                >
                  {m.status}
                </span>
                <Link to={`/admin/modules/${m.id}`} className="btn-secondary">
                  Manage Content
                </Link>
                <button onClick={() => togglePublish(m)} className="btn-primary">
                  {m.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
