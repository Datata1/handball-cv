import type resources from './resources'
import type { defaultNS } from './resources'

// Makes t() key-checked: a key that no namespace defines is a compile error.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: typeof resources
    returnNull: false
  }
}
