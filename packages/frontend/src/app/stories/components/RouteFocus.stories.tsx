import type { Meta, StoryObj } from '@storybook/react-vite'

import { RouteFocusProvider, useRouteFocus } from '@/app/components/RouteFocus'
import { MAIN_CONTENT_ID } from '@/app/focus'
import { PageHeader } from '@/shared/ui'
import { withRouter } from '@/testing/router'

/**
 * There is nothing to look at here: the provider renders its children and one
 * empty live region, and the ref it hands out only does something when the URL
 * changes. The story exists so both are rendered and axe-checked, and so the
 * shape `__root.tsx` mounts is written down somewhere.
 */
function ShellLikeRoot() {
  return (
    <RouteFocusProvider>
      <Content />
    </RouteFocusProvider>
  )
}

// Below the provider: the hook reads the context the provider mounts.
function Content() {
  const content = useRouteFocus<HTMLElement>()

  return (
    <main id={MAIN_CONTENT_ID} ref={content} tabIndex={-1}>
      <PageHeader title="Übersicht" description="Die Ansicht, auf der man landet." />
    </main>
  )
}

const meta = {
  title: 'App/RouteFocus',
  component: ShellLikeRoot,
  parameters: { layout: 'padded' },
  decorators: [withRouter()],
} satisfies Meta<typeof ShellLikeRoot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
