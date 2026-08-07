import { useTranslation } from 'react-i18next'

import type resources from './resources'

/**
 * Groups in the `domain` namespace whose keys are values the backend sends.
 * Their contents are an open set: `formation-summary` returns `dict[str, int]`,
 * and the label sets change when the GCN + LSTM models land.
 */
export type BackendLabelGroup = keyof (typeof resources)['domain']

export type BackendLabel = (group: BackendLabelGroup, value: string) => string

/**
 * Looks a backend value up in `domain`, falling back to the raw value.
 *
 * Never key a component off a frontend dictionary instead — that was the legacy
 * `PLAY_TYPE_META` bug, where an unrecognised play type rendered nothing at all.
 */
export function useBackendLabel(): BackendLabel {
  const { t } = useTranslation('domain')

  return (group, value) => {
    // Typed keys cannot describe a set the backend may extend, so this one
    // lookup is deliberately untyped. The fallback is what makes it safe.
    const lookup = t as (key: string, options: { defaultValue: string }) => string

    return lookup(`${group}.${value}`, { defaultValue: value })
  }
}
