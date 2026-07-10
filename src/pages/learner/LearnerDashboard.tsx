import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import type { LearnerProgress, Module } from '@/lib/types';
import { AppHeader } from '@/components/layout/AppHeader';

interface ModuleWithProgress extends Module {
  progress?: LearnerProgress;
}

export default function LearnerDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    async function load() {
      const { data: moduleData } = await supabase
        .from('modules')
        .select('*')
        .eq('status', 'published')
        .order('order_index');

      const { data: progressData } = await supabase
        .from('learner_progress')
        .select('*')
        .eq('learner_id', profile!.id);

      const progressByModule = new Map((progressData as LearnerProgress[] ?? []).map((p) => [p.module_id, p]));

      setModules(
        ((moduleData as Module[]) ?? []).map((m) => ({ ...m, progress: progressByModule.get(m.id) }))
      );
      setLoading(false);
    }

    load();
  }, [profile]);

  const isAr = i18n.language === 'ar';
  const completedCount = modules.filter((m) => m.progress?.is_completed).length;
  const completionPct = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-brand-50">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-ink/50">{t('nav.progress')}</p>
            <p className="text-2xl font-bold text-brand-700">{completionPct}%</p>
          </div>
          <div className="card">
            <p className="text-sm text-ink/50">Completed Modules</p>
            <p className="text-2xl font-bold text-brand-700">
              {completedCount}/{modules.length}
            </p>
          </div>
          <Link to="/certificate" className="card block hover:shadow-cardHover transition-shadow">
            <p className="text-sm text-ink/50">{t('nav.certificate')}</p>
            <p className="text-2xl font-bold text-brand-700">{completedCount === modules.length && modules.length > 0 ? 'Ready' : 'Locked'}</p>
          </Link>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-brand-800 mb-3">{t('nav.modules')}</h2>
          {loading ? (
            <p className="text-ink/50">{t('common.loading')}</p>
          ) : (
            <div className="space-y-3">
              {modules.map((m, idx) => {
                const stage = m.progress?.stage ?? (idx === 0 ? 'pre_quiz' : 'locked');
                const isLocked = stage === 'locked';
                return (
                  <div key={m.id} className="card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full grid place-items-center font-bold shrink-0 ${
                          m.progress?.is_completed
                            ? 'bg-success text-white'
                            : isLocked
                              ? 'bg-gray-200 text-gray-400'
                              : 'bg-brand-100 text-brand-700'
                        }`}
                      >
                        {m.progress?.is_completed ? '✓' : idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{isAr ? m.name_ar : m.name_en}</p>
                        <p className="text-xs text-ink/50 capitalize">{stage.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <Link to={isLocked ? '#' : `/module/${m.id}`} className={isLocked ? 'pointer-events-none' : ''}>
                      <button className="btn-secondary" disabled={isLocked}>
                        {m.progress?.is_completed ? 'Review' : isLocked ? 'Locked' : 'Continue'}
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
