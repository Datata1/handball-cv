import { Film } from 'lucide-react'
import { useState } from 'react'

/**
 * The still the backend decodes out of frame 42.
 *
 * It is a video decode per request, sent without cache headers, and it fails
 * outright on a video shorter than 43 frames — so it loads lazily, keeps its
 * box either way, and falls back to a placeholder rather than a broken image.
 * Decorative: the card's title link is what names the match.
 */
export function MatchThumbnail({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted">
      {src === null || failed ? (
        <Film aria-hidden="true" className="size-8 text-muted-foreground" />
      ) : (
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is the image failing to load, not somebody interacting with it.
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
