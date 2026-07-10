import { useTranslation } from 'react-i18next';
import { setLanguage } from '@/i18n/config';

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  return (
    <button
      onClick={() => setLanguage(isArabic ? 'en' : 'ar')}
      className="text-sm font-medium text-brand-600 border border-brand-200 rounded-control px-3 py-1.5 hover:bg-brand-50 transition-colors"
      aria-label="Switch language"
    >
      {isArabic ? 'English' : 'العربية'}
    </button>
  );
}
