import common from './locales/de/common.json'
import dashboard from './locales/de/dashboard.json'
import defense from './locales/de/defense.json'
import domain from './locales/de/domain.json'
import overview from './locales/de/overview.json'
import players from './locales/de/players.json'
import report from './locales/de/report.json'
import upload from './locales/de/upload.json'

export const DEFAULT_LOCALE = 'de'

export const defaultNS = 'common'

// One namespace per feature area, so a feature PR adds its own file rather than
// editing a shared one and colliding with every other feature PR in review.
const resources = {
  common,
  domain,
  dashboard,
  upload,
  report,
  overview,
  players,
  defense,
} as const

export default resources
