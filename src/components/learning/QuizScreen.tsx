import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';

interface QuestionRow {
  id: string;
  question_text_en: string;
  question_text_ar: string;
  image_url: string | null;
  order_index: number;
}

interface ChoiceRow {
  id: string;
  question_id: string;
  choice_text_en: string;
  choice_text_ar: string;
  order_index: number;
}

interface QuizScreenProps {
  moduleId: string;
  quizType: 'pre' | 'post';
  onPassed: () => void; // post-quiz passed -> module completed, unlock next
  onDone: () => void; // pre-quiz done (always) -> advance to video stage
}

export function QuizScreen({ moduleId, quizType, onPassed, onDone }: QuizScreenProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [choicesByQuestion, setChoicesByQuestion] = useState<Record<string, ChoiceRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> choice_id
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: qData } = await supabase
        .from('questions')
        .select('id, question_text_en, question_text_ar, image_url, order_index')
        .eq('module_id', moduleId)
        .eq('status', 'published')
        .order('order_index');

      const qList = (qData as QuestionRow[]) ?? [];
      setQuestions(qList);

      if (qList.length > 0) {
        const { data: cData } = await supabase
          .from('quiz_questions_public')
          .select('id, question_id, choice_text_en, choice_text_ar, order_index')
          .in(
            'question_id',
            qList.map((q) => q.id)
          )
          .order('order_index');

        const grouped: Record<string, ChoiceRow[]> = {};
        ((cData as ChoiceRow[]) ?? []).forEach((c) => {
          grouped[c.question_id] = grouped[c.question_id] || [];
          grouped[c.question_id].push(c);
        });
        setChoicesByQuestion(grouped);
      }
      setLoading(false);
    }
    load();
    // Reset state when switching quiz type (pre vs post) or retrying
  }, [moduleId, quizType]);

  function selectChoice(questionId: string, choiceId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const responses = questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id] ?? null }));

    const { data, error: rpcError } = await supabase.rpc('submit_quiz_attempt', {
      p_module_id: moduleId,
      p_quiz_type: quizType,
      p_responses: responses,
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setResult({ score: row.score_percentage, passed: row.passed });
  }

  function retry() {
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
  }

  if (loading) {
    return <p className="text-ink/50 text-center py-10">{t('common.loading')}</p>;
  }

  if (questions.length === 0) {
    return <p className="text-ink/50 text-center py-10">This module has no quiz questions yet.</p>;
  }

  // ---- Result screen ----
  if (result) {
    const isPostQuiz = quizType === 'post';
    const passed = isPostQuiz ? result.passed : true; // pre-quiz always "continues"

    return (
      <div className="card text-center space-y-4">
        <p className="text-sm text-ink/50 uppercase tracking-wide">
          {quizType === 'pre' ? 'Pre-Quiz' : 'Post-Quiz'} Result
        </p>
        <p className="text-4xl font-bold text-brand-700">{result.score}%</p>

        {isPostQuiz && (
          <p className={`font-semibold ${passed ? 'text-success' : 'text-error'}`}>
            {passed ? 'Passed ✓' : 'Not yet — 80% required'}
          </p>
        )}

        {isPostQuiz && !passed && (
          <button onClick={retry} className="btn-secondary">
            {t('common.retry')}
          </button>
        )}

        {isPostQuiz && passed && (
          <button onClick={onPassed} className="btn-primary">
            {t('common.continue')}
          </button>
        )}

        {!isPostQuiz && (
          <button onClick={onDone} className="btn-primary">
            {t('common.continue')}
          </button>
        )}
      </div>
    );
  }

  // ---- Question screen ----
  const question = questions[currentIndex];
  const choices = choicesByQuestion[question.id] ?? [];
  const isLast = currentIndex === questions.length - 1;
  const allAnswered = questions.every((q) => answers[q.id]);

  return (
    <div className="card space-y-6">
      <div>
        <div className="flex justify-between text-sm text-ink/50 mb-2">
          <span>
            Question {currentIndex + 1} / {questions.length}
          </span>
          <span className="uppercase">{quizType}-Quiz</span>
        </div>
        <div className="w-full h-2 bg-brand-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <p className="text-lg font-medium">{isAr ? question.question_text_ar : question.question_text_en}</p>
      {question.image_url && <img src={question.image_url} alt="" className="rounded-control max-h-64" />}

      <div className="space-y-2">
        {choices.map((c) => {
          const selected = answers[question.id] === c.id;
          return (
            <button
              key={c.id}
              onClick={() => selectChoice(question.id, c.id)}
              className={`w-full text-left rtl:text-right border rounded-control px-4 py-3 transition-colors ${
                selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-200'
              }`}
            >
              {isAr ? c.choice_text_ar : c.choice_text_en}
            </button>
          );
        })}
      </div>

      {error && <div className="text-sm text-error bg-error/10 rounded-control px-3 py-2">{error}</div>}

      <div className="flex justify-between pt-2">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="btn-secondary"
        >
          {t('common.back')}
        </button>

        {isLast ? (
          <button onClick={handleSubmit} disabled={!allAnswered || submitting} className="btn-primary">
            {submitting ? t('common.loading') : t('common.submit')}
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={!answers[question.id]}
            className="btn-primary"
          >
            {t('common.next')}
          </button>
        )}
      </div>
    </div>
  );
}
