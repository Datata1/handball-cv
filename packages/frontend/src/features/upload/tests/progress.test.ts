import { formatBytes, transferStats } from '../progress'

describe('transferStats', () => {
  it('reports the share transferred', () => {
    expect(transferStats(250, 1000, 5000).percent).toBe(25)
  })

  it('withholds rate and ETA until the sample is long enough to mean anything', () => {
    const stats = transferStats(200, 1000, 300)

    expect(stats.bytesPerSecond).toBeNull()
    expect(stats.secondsRemaining).toBeNull()
  })

  it('derives the rate and the remaining time from what has actually gone', () => {
    const stats = transferStats(2_000_000, 10_000_000, 4000)

    expect(stats.bytesPerSecond).toBe(500_000)
    expect(stats.secondsRemaining).toBe(16)
  })

  it('drops the ETA once every byte is sent — the wait left is the server', () => {
    const stats = transferStats(1000, 1000, 10_000)

    expect(stats.percent).toBe(100)
    expect(stats.secondsRemaining).toBeNull()
  })

  it('clamps a percentage past the total rather than overflowing the bar', () => {
    expect(transferStats(1200, 1000, 10_000).percent).toBe(100)
  })

  it('reads an unknown total as 0%, not as NaN', () => {
    expect(transferStats(0, 0, 0).percent).toBe(0)
  })
})

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [1500, '1,5 kB'],
    [80_000_000, '80 MB'],
    [3 * 1000 ** 3, '3 GB'],
  ])('formats %d as %s in German', (bytes, expected) => {
    expect(formatBytes(bytes, 'de')).toBe(expected)
  })

  it('follows the locale separator', () => {
    expect(formatBytes(1500, 'en')).toBe('1.5 kB')
  })
})
