import { DEFAULT_LOCALE, LOCALES, type Locale } from '@presidency-bingo/shared';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...LOCALES],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export function currentLocale(): Locale {
  return LOCALES.find((locale) => i18n.resolvedLanguage === locale) ?? DEFAULT_LOCALE;
}

export default i18n;
