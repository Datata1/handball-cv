import { composeStories } from '@storybook/react-vite'
import { render, screen } from '@testing-library/react'

import { expectNoA11yViolations } from '@/testing/axe'

import { toPercent } from '../../data/percent'
import * as stories from '../../stories/data/Bar.stories'

const { Default, CountedAgainstTotal, Zero, Distribution } = composeStories(stories)

describe('toPercent', () => {
  it.each([
    [0.62, 1, 62],
    [34, 91, 37.36263736263736],
    [3, 2, 100],
    [-1, 2, 0],
    // A total of zero is the normal "nothing measured yet" case, not a bug.
    [1, 0, 0],
    [Number.NaN, 1, 0],
  ])('maps %s of %s to %s%%', (value, max, expected) => {
    expect(toPercent(value, max)).toBeCloseTo(expected, 10)
  })
})

describe('Bar', () => {
  it('labels the share in German percent notation', () => {
    render(<Default />)

    expect(screen.getByText('62 %')).toBeVisible()
  })

  it('lets the caller replace the share with the underlying figure', () => {
    render(<CountedAgainstTotal />)

    expect(screen.getByText('34 von 91')).toBeVisible()
    expect(screen.queryByText('37 %')).not.toBeInTheDocument()
  })

  it('renders an empty track at zero', () => {
    render(<Zero />)

    expect(screen.getByText('0 %')).toBeVisible()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Distribution />)

    await expectNoA11yViolations(container)
  })
})
