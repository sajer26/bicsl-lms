import { useTranslation } from 'react-i18next';

interface CompletionCelebrationProps {
  moduleName: string;
  isLastModule: boolean;
  onContinue: () => void;
}

export function CompletionCelebration({ moduleName, isLastModule, onContinue }: CompletionCelebrationProps) {
  const { t } = useTranslation();

  return (
    <div className="card text-center space-y-4 py-10">
      <div className="text-6xl animate-bounce">🎉</div>
      <h2 className="text-2xl font-bold text-brand-800">Congratulations!</h2>
      <p className="text-ink/70">
        You've completed <span className="font-semibold">{moduleName}</span>.
      </p>
      <div className="inline-block bg-success-bg text-success font-medium rounded-full px-4 py-1.5 text-sm">
        🏅 Badge Earned
      </div>
      <div>
        <button onClick={onContinue} className="btn-primary">
          {isLastModule ? 'View Certificate' : t('common.continue')}
        </button>
      </div>
    </div>
  );
}
