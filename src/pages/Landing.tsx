import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';

const highlights = [
  'landing.free',
  'landing.certificateValidity',
  'landing.sevenComponents',
  'landing.bilingual',
  'landing.compatible',
] as const;

export default function Landing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-brand-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-brand-500 text-white grid place-items-center font-bold">
            B
          </div>
          <span className="font-semibold text-brand-700">{t('app.name')}</span>
        </div>
        <LanguageSwitch />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 bg-gradient-to-b from-brand-50 to-white">
        <h1 className="text-3xl md:text-5xl font-bold text-brand-800 max-w-2xl">
          {t('landing.welcome')}
        </h1>
        <p className="mt-4 text-lg text-ink/80 max-w-xl">{t('landing.tagline')}</p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link to="/register" className="btn-primary">
            {t('landing.registerStaff')}
          </Link>
          <Link to="/sign-in" className="btn-secondary">
            {t('landing.signIn')}
          </Link>
        </div>

        <Link
          to="/super-admin/sign-in"
          className="mt-6 text-sm text-ink/50 hover:text-brand-600 underline underline-offset-4"
        >
          {t('landing.superAdminLogin')}
        </Link>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-5 gap-4 max-w-4xl w-full">
          {highlights.map((key) => (
            <div key={key} className="card text-sm font-medium text-brand-700">
              ✅ {t(key)}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
