import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Module, ModuleResource, ModuleStage } from '@/lib/types';
import { AppHeader } from '@/components/layout/AppHeader';
import { VideoPlayer } from '@/components/learning/VideoPlayer';
import { ResourceList } from '@/components/learning/ResourceList';
import { QuizScreen } from '@/components/learning/QuizScreen';
import { CompletionCelebration } from '@/components/learning/CompletionCelebration';

type View = 'loading' | 'locked' | 'pre_quiz' | 'video' | 'resources' | 'post_quiz' | 'celebration' | 'review';

export default function ModuleScreen() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  const [module, setModule] = useState<Module | null>(null);
  const [resources, setResources] = useState<ModuleResource[]>([]);
  const [view, setView] = useState<View>('loading');
  const [isLastModule, setIsLastModule] = useState(false);

  const load = useCallback(async () => {
    if (!moduleId || !profile) return;

    const { data: moduleData } = await supabase.from('modules').select('*').eq('id', moduleId).single();
    if (!moduleData) {
      setView('locked');
      return;
    }
    setModule(moduleData as Module);

    const { data: resourceData } = await supabase
      .from('module_resources')
      .select('*')
      .eq('module_id', moduleId)
      .order('display_order');
    setResources((resourceData as ModuleResource[]) ?? []);

    const { data: nextModule } = await supabase
      .from('modules')
      .select('id')
      .eq('course_id', moduleData.course_id)
      .eq('order_index', moduleData.order_index + 1)
      .eq('status', 'published')
      .maybeSingle();
    setIsLastModule(!nextModule);

    const { data: progress } = await supabase
      .from('learner_progress')
      .select('stage, is_completed')
      .eq('learner_id', profile.id)
      .eq('module_id', moduleId)
      .maybeSingle();

    if (progress) {
      setView(progress.is_completed ? 'review' : (progress.stage as ModuleStage as View));
    } else if (moduleData.order_index === 1) {
      setView('pre_quiz');
    } else {
      setView('locked');
    }
  }, [moduleId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function advanceTo(stage: 'video' | 'resources' | 'post_quiz') {
    if (!moduleId) return;
    await supabase.rpc('advance_module_stage', { p_module_id: moduleId, p_stage: stage });
    setView(stage);
  }

  if (view === 'loading' || !module) {
    return (
      <div className="min-h-screen bg-brand-50">
        <AppHeader />
        <p className="text-center text-ink/50 py-16">{t('common.loading')}</p>
      </div>
    );
  }

  if (view === 'locked') {
    return (
      <div className="min-h-screen bg-brand-50">
        <AppHeader />
        <div className="max-w-lg mx-auto text-center py-16">
          <p className="text-ink/60 mb-4">This module is locked. Complete the previous module first.</p>
          <Link to="/dashboard" className="btn-primary">
            {t('nav.dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  const videoResource = resources.find((r) => r.resource_type === 'video');
  const name = isAr ? module.name_ar : module.name_en;

  return (
    <div className="min-h-screen bg-brand-50">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Module header — spec §19 */}
        <div className="card flex items-center gap-4">
          {module.image_url && (
            <img src={module.image_url} alt="" className="w-16 h-16 rounded-control object-cover" />
          )}
          <div>
            <p className="text-xs text-brand-500 font-medium">{module.module_code}</p>
            <h1 className="text-xl font-bold text-brand-800">{name}</h1>
            <p className="text-sm text-ink/60">{isAr ? module.description_ar : module.description_en}</p>
          </div>
        </div>

        {view === 'pre_quiz' && (
          <QuizScreen
            moduleId={module.id}
            quizType="pre"
            onDone={() => setView('video')}
            onPassed={() => setView('video')}
          />
        )}

        {view === 'video' && (
          <div className="space-y-4">
            {videoResource?.video_external_id ? (
              <VideoPlayer
                youtubeId={videoResource.video_external_id}
                title={isAr ? videoResource.title_ar : videoResource.title_en}
              />
            ) : (
              <p className="text-ink/50 card">No video uploaded for this module yet.</p>
            )}
            <div className="text-right rtl:text-left">
              <button onClick={() => advanceTo('resources')} className="btn-primary">
                {t('common.continue')}
              </button>
            </div>
          </div>
        )}

        {view === 'resources' && (
          <div className="space-y-4">
            <ResourceList resources={resources} />
            <div className="text-right rtl:text-left">
              <button onClick={() => advanceTo('post_quiz')} className="btn-primary">
                Continue to Post-Quiz
              </button>
            </div>
          </div>
        )}

        {view === 'post_quiz' && (
          <QuizScreen
            moduleId={module.id}
            quizType="post"
            onDone={() => {}}
            onPassed={() => setView('celebration')}
          />
        )}

        {view === 'celebration' && (
          <CompletionCelebration
            moduleName={name}
            isLastModule={isLastModule}
            onContinue={() => navigate(isLastModule ? '/certificate' : '/dashboard')}
          />
        )}

        {view === 'review' && (
          <div className="space-y-4">
            <div className="card bg-success-bg text-success text-sm font-medium">
              ✓ Completed — you can review the content below anytime.
            </div>
            {videoResource?.video_external_id && (
              <VideoPlayer
                youtubeId={videoResource.video_external_id}
                title={isAr ? videoResource.title_ar : videoResource.title_en}
              />
            )}
            <ResourceList resources={resources} />
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-brand-100">
          <Link to="/dashboard" className="btn-secondary">
            {t('nav.dashboard')}
          </Link>
        </div>
      </main>
    </div>
  );
}
