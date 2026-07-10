import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import type { Module } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

export default function Welcome() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('modules')
      .select('*')
      .eq('status', 'published')
      .order('order_index')
      .then(({ data }) => {
        setModules((data as Module[]) ?? []);
        setLoading(false);
      });
  }, []);

  const isAr = i18n.language === 'ar';

  return (
    <div className="min-h-screen bg-brand-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="card text-center">
          <h1 className="text-2xl font-bold text-brand-800">
            {profile ? `${t('landing.welcome')}, ${profile.full_name}` : t('landing.welcome')}
          </h1>

          {/* Welcome video: embedded custom player, module video component reused here */}
          <div className="mt-4 aspect-video bg-brand-900/90 rounded-card grid place-items-center text-white text-sm">
            Welcome video player placeholder (embedded, in-platform)
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-medium text-brand-700">
            <span className="card !p-2">✅ {t('landing.free')}</span>
            <span className="card !p-2">✅ {t('landing.certificateValidity')}</span>
            <span className="card !p-2">✅ {t('landing.sevenComponents')}</span>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-brand-800 mb-3">{t('nav.modules')}</h2>
          {loading ? (
            <p className="text-ink/50">{t('common.loading')}</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {modules.map((m, idx) => (
                <div key={m.id} className="card flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium">{isAr ? m.name_ar : m.name_en}</p>
                    <p className="text-xs text-ink/50">{m.module_code}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link to="/dashboard" className="btn-primary">
            {t('common.continue')}
          </Link>
        </div>
      </div>
    </div>
  );
}
