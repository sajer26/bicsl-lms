import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

export function AppHeader() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();

  return (
    <header className="bg-white border-b border-brand-100 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-brand-500 text-white grid place-items-center font-bold text-sm">
          B
        </div>
        <span className="font-semibold text-brand-700">{t('app.name')}</span>
      </div>

      <div className="flex items-center gap-4">
        {profile && <span className="text-sm text-ink/70 hidden sm:inline">{profile.full_name}</span>}
        <LanguageSwitch />
        <button onClick={signOut} className="text-sm text-ink/50 hover:text-error transition-colors">
          {t('auth.signOut')}
        </button>
      </div>
    </header>
  );
}
