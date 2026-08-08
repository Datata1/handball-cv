import { extensionOf, isLargeFile, LARGE_FILE_BYTES, rejectFile } from '../validation'

function file(name: string) {
  return new File(['x'], name)
}

describe('rejectFile', () => {
  it.each(['spiel.mp4', 'spiel.AVI', 'spiel.mov', 'spiel.mkv'])(
    'accepts %s whatever its casing',
    (name) => {
      expect(rejectFile(file(name))).toBeNull()
    },
  )

  it('rejects a format the pipeline cannot read', () => {
    expect(rejectFile(file('notizen.txt'))).toBe('unsupportedFormat')
  })

  // The backend's check is `filename.split(".")[-1]`, which on a name with no
  // dot returns the whole name — so this is its own message, not "„spiel“ is
  // not supported".
  it('rejects a name with no extension at all', () => {
    expect(rejectFile(file('spielaufzeichnung'))).toBe('missingExtension')
  })

  it('reads the last dot segment, as the backend does', () => {
    expect(rejectFile(file('spiel.mp4.txt'))).toBe('unsupportedFormat')
    expect(rejectFile(file('spiel.final.mp4'))).toBeNull()
  })

  // A `video/*` filter is what the legacy drop handler used, and browsers
  // report Matroska with an empty type on most platforms.
  it('does not consult the MIME type', () => {
    expect(rejectFile(new File(['x'], 'spiel.mkv', { type: '' }))).toBeNull()
  })
})

describe('extensionOf', () => {
  it('lowercases', () => {
    expect(extensionOf('SPIEL.MP4')).toBe('mp4')
  })
})

describe('isLargeFile', () => {
  it('warns only above the threshold', () => {
    expect(isLargeFile(LARGE_FILE_BYTES)).toBe(false)
    expect(isLargeFile(LARGE_FILE_BYTES + 1)).toBe(true)
  })
})
