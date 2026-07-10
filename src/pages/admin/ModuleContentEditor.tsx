import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { logAudit } from '@/lib/audit';
import type { Module, ModuleResource } from '@/lib/types';

interface QuestionRow {
  id: string;
  question_text_en: string;
  question_text_ar: string;
  order_index: number;
}
interface ChoiceRow {
  id: string;
  question_id: string;
  choice_text_en: string;
  choice_text_ar: string;
  is_correct: boolean;
  order_index: number;
}

const BUCKET = 'module-resources';

export default function ModuleContentEditor() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const [module, setModule] = useState<Module | null>(null);
  const [resources, setResources] = useState<ModuleResource[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [choices, setChoices] = useState<Record<string, ChoiceRow[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    const [{ data: mod }, { data: res }, { data: qs }] = await Promise.all([
      supabase.from('modules').select('*').eq('id', moduleId).single(),
      supabase.from('module_resources').select('*').eq('module_id', moduleId).order('display_order'),
      supabase.from('questions').select('id, question_text_en, question_text_ar, order_index').eq('module_id', moduleId).order('order_index'),
    ]);
    setModule(mod as Module);
    setResources((res as ModuleResource[]) ?? []);
    setQuestions((qs as QuestionRow[]) ?? []);

    if (qs && qs.length > 0) {
      const { data: cs } = await supabase
        .from('answer_choices')
        .select('*')
        .in('question_id', qs.map((q: QuestionRow) => q.id))
        .order('order_index');
      const grouped: Record<string, ChoiceRow[]> = {};
      ((cs as ChoiceRow[]) ?? []).forEach((c) => {
        grouped[c.question_id] = grouped[c.question_id] || [];
        grouped[c.question_id].push(c);
      });
      setChoices(grouped);
    }
    setLoading(false);
  }, [moduleId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !module) return <p className="text-ink/50">Loading...</p>;

  const videoResource = resources.find((r) => r.resource_type === 'video');
  const otherResources = resources.filter((r) => r.resource_type !== 'video');

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/modules" className="text-sm text-brand-600 hover:underline">
          ← Back to Modules
        </Link>
        <h1 className="text-xl font-bold text-brand-800 mt-1">
          {module.module_code} — {module.name_en}
        </h1>
      </div>

      <VideoSection moduleId={module.id} existing={videoResource} onSaved={load} />
      <ResourcesSection moduleId={module.id} resources={otherResources} onChanged={load} />
      <QuizSection moduleId={module.id} questions={questions} choices={choices} onChanged={load} />
    </div>
  );
}

// ============================================================================
// Video
// ============================================================================

function VideoSection({
  moduleId,
  existing,
  onSaved,
}: {
  moduleId: string;
  existing?: ModuleResource;
  onSaved: () => void;
}) {
  const [videoId, setVideoId] = useState(existing?.video_external_id ?? '');
  const [titleEn, setTitleEn] = useState(existing?.title_en ?? '');
  const [titleAr, setTitleAr] = useState(existing?.title_ar ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    if (existing) {
      await supabase
        .from('module_resources')
        .update({ video_external_id: videoId, title_en: titleEn, title_ar: titleAr })
        .eq('id', existing.id);
    } else {
      await supabase.from('module_resources').insert({
        module_id: moduleId,
        resource_type: 'video',
        video_provider: 'youtube',
        video_external_id: videoId,
        title_en: titleEn,
        title_ar: titleAr,
        language: 'both',
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold text-brand-800">Training Video</h2>
      <p className="text-xs text-ink/50">
        Upload the video as Unlisted on YouTube, then paste its video ID here (the part after
        "v=" in the URL).
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input
          placeholder="YouTube Video ID"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="border border-brand-200 rounded-control px-3 py-2"
        />
        <input
          placeholder="Title (English)"
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          className="border border-brand-200 rounded-control px-3 py-2"
        />
        <input
          placeholder="العنوان (عربي)"
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          className="border border-brand-200 rounded-control px-3 py-2"
        />
      </div>
      <button onClick={save} disabled={saving || !videoId} className="btn-primary">
        {saving ? 'Saving...' : 'Save Video'}
      </button>
    </section>
  );
}

// ============================================================================
// Resources (PDF / Poster / Image / File / External Link)
// ============================================================================

function ResourcesSection({
  moduleId,
  resources,
  onChanged,
}: {
  moduleId: string;
  resources: ModuleResource[];
  onChanged: () => void;
}) {
  const [type, setType] = useState<'pdf' | 'poster' | 'image' | 'file' | 'external_link'>('pdf');
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    if (!titleEn || !titleAr) {
      setError('Title (EN & AR) is required.');
      return;
    }
    setUploading(true);

    try {
      let storagePath: string | null = null;

      if (type === 'external_link') {
        storagePath = externalUrl;
      } else {
        if (!file) throw new Error('Please choose a file.');
        const path = `${moduleId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
        if (uploadError) throw uploadError;
        storagePath = path;
      }

      const { data: created, error: insertError } = await supabase
        .from('module_resources')
        .insert({
          module_id: moduleId,
          resource_type: type,
          title_en: titleEn,
          title_ar: titleAr,
          storage_path: storagePath,
          display_order: resources.length,
          language: 'both',
        })
        .select()
        .single();
      if (insertError) throw insertError;
      logAudit('resource.upload', 'module_resources', created?.id, { type, title: titleEn });

      setTitleEn('');
      setTitleAr('');
      setFile(null);
      setExternalUrl('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await supabase.from('module_resources').delete().eq('id', id);
    logAudit('resource.delete', 'module_resources', id);
    onChanged();
  }

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-brand-800">Learning Resources</h2>

      <div className="space-y-2">
        {resources.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-brand-50 pb-2">
            <div>
              <span className="text-xs uppercase text-brand-500 font-medium mr-2">{r.resource_type}</span>
              {r.title_en}
            </div>
            <button onClick={() => remove(r.id)} className="text-error text-xs hover:underline">
              Delete
            </button>
          </div>
        ))}
        {resources.length === 0 && <p className="text-sm text-ink/40">No resources yet.</p>}
      </div>

      <div className="border-t border-brand-100 pt-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="border border-brand-200 rounded-control px-3 py-2"
          >
            <option value="pdf">PDF Document</option>
            <option value="poster">Poster</option>
            <option value="image">Image</option>
            <option value="file">Downloadable File</option>
            <option value="external_link">External Link</option>
          </select>
          <input
            placeholder="Title (English)"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="border border-brand-200 rounded-control px-3 py-2"
          />
          <input
            placeholder="العنوان (عربي)"
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            className="border border-brand-200 rounded-control px-3 py-2"
          />
          {type === 'external_link' ? (
            <input
              placeholder="https://..."
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="border border-brand-200 rounded-control px-3 py-2"
            />
          ) : (
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          )}
        </div>
        {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}
        <button onClick={handleAdd} disabled={uploading} className="btn-primary">
          {uploading ? 'Uploading...' : '+ Add Resource'}
        </button>
      </div>
    </section>
  );
}

// ============================================================================
// Quiz Bank
// ============================================================================

function QuizSection({
  moduleId,
  questions,
  choices,
  onChanged,
}: {
  moduleId: string;
  questions: QuestionRow[];
  choices: Record<string, ChoiceRow[]>;
  onChanged: () => void;
}) {
  const [qEn, setQEn] = useState('');
  const [qAr, setQAr] = useState('');
  const [choiceInputs, setChoiceInputs] = useState([
    { en: '', ar: '', correct: true },
    { en: '', ar: '', correct: false },
    { en: '', ar: '', correct: false },
    { en: '', ar: '', correct: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateChoice(idx: number, field: 'en' | 'ar', value: string) {
    setChoiceInputs((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  }
  function markCorrect(idx: number) {
    setChoiceInputs((prev) => prev.map((c, i) => ({ ...c, correct: i === idx })));
  }

  async function addQuestion() {
    setError(null);
    if (!qEn || !qAr || choiceInputs.some((c) => !c.en || !c.ar)) {
      setError('Question text and all 4 choices (EN & AR) are required.');
      return;
    }
    setSaving(true);
    try {
      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert({ module_id: moduleId, question_text_en: qEn, question_text_ar: qAr, order_index: questions.length })
        .select()
        .single();
      if (qError) throw qError;

      const { error: cError } = await supabase.from('answer_choices').insert(
        choiceInputs.map((c, idx) => ({
          question_id: question.id,
          choice_text_en: c.en,
          choice_text_ar: c.ar,
          is_correct: c.correct,
          order_index: idx,
        }))
      );
      if (cError) throw cError;
      logAudit('question.create', 'questions', question.id);

      setQEn('');
      setQAr('');
      setChoiceInputs([
        { en: '', ar: '', correct: true },
        { en: '', ar: '', correct: false },
        { en: '', ar: '', correct: false },
        { en: '', ar: '', correct: false },
      ]);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question.');
    } finally {
      setSaving(false);
    }
  }

  async function removeQuestion(id: string) {
    await supabase.from('questions').delete().eq('id', id);
    logAudit('question.delete', 'questions', id);
    onChanged();
  }

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-brand-800">Quiz Bank</h2>
      <p className="text-xs text-ink/50">
        The same questions are used for both the Pre-Quiz and Post-Quiz. Passing score is fixed
        at 80% (enforced server-side).
      </p>

      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div key={q.id} className="border-b border-brand-50 pb-3">
            <div className="flex justify-between items-start">
              <p className="font-medium">
                {idx + 1}. {q.question_text_en}
              </p>
              <button onClick={() => removeQuestion(q.id)} className="text-error text-xs hover:underline shrink-0 ml-2">
                Delete
              </button>
            </div>
            <ul className="text-sm text-ink/60 mt-1 space-y-0.5">
              {(choices[q.id] ?? []).map((c) => (
                <li key={c.id} className={c.is_correct ? 'text-success font-medium' : ''}>
                  {c.is_correct ? '✓ ' : '• '}
                  {c.choice_text_en}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-ink/40">No questions yet.</p>}
      </div>

      <div className="border-t border-brand-100 pt-4 space-y-3">
        <h3 className="text-sm font-semibold">Add Question</h3>
        <input
          placeholder="Question (English)"
          value={qEn}
          onChange={(e) => setQEn(e.target.value)}
          className="w-full border border-brand-200 rounded-control px-3 py-2"
        />
        <input
          placeholder="السؤال (عربي)"
          value={qAr}
          onChange={(e) => setQAr(e.target.value)}
          className="w-full border border-brand-200 rounded-control px-3 py-2"
        />
        {choiceInputs.map((c, idx) => (
          <div key={idx} className="grid sm:grid-cols-[auto,1fr,1fr] gap-2 items-center">
            <label className="flex items-center gap-1 text-xs text-ink/60">
              <input type="radio" checked={c.correct} onChange={() => markCorrect(idx)} />
              Correct
            </label>
            <input
              placeholder={`Choice ${idx + 1} (English)`}
              value={c.en}
              onChange={(e) => updateChoice(idx, 'en', e.target.value)}
              className="border border-brand-200 rounded-control px-3 py-2"
            />
            <input
              placeholder={`الاختيار ${idx + 1} (عربي)`}
              value={c.ar}
              onChange={(e) => updateChoice(idx, 'ar', e.target.value)}
              className="border border-brand-200 rounded-control px-3 py-2"
            />
          </div>
        ))}
        {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}
        <button onClick={addQuestion} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : '+ Add Question'}
        </button>
      </div>
    </section>
  );
}
