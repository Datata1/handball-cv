import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import resources, { DEFAULT_LOCALE, defaultNS } from './resources'

// No language detector: one locale, so the browser's preference is irrelevant.
// Resources are bundled rather than fetched, so init resolves synchronously and
// the first render already has copy.
void i18next.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS,
  ns: Object.keys(resources),
  resources: { [DEFAULT_LOCALE]: resources },
  // React escapes interpolated values itself.
  interpolation: { escapeValue: false },
})

export { DEFAULT_LOCALE }

export default i18next
