import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import sv from './sv'
import en from './en'

const savedLang = localStorage.getItem('language') ?? 'sv'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      sv: { translation: sv },
      en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'sv',
    interpolation: { escapeValue: false },
  })

export default i18n
