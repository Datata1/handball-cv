import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { withStores } from '@/testing/stores'

import { ShareMomentButton } from '../../components/ShareMomentButton'
import { DURATION_S } from '../report'

const meta = {
  title: 'Report/ShareMomentButton',
  component: ShareMomentButton,
  args: { onShare: fn() },
  parameters: { layout: 'padded' },
  decorators: [
    withStores((store) => {
      store.player.setDuration(DURATION_S)
      store.player.seek(754.2)
      store.player.clearSeek()
    }),
  ],
} satisfies Meta<typeof ShareMomentButton>

export default meta
type Story = StoryObj<typeof meta>

/** The button carries the position it would link to, to the second. */
export const Default: Story = {}

/** At the start of the match, before anything has been played. */
export const AtStart: Story = {
  decorators: [withStores()],
}
