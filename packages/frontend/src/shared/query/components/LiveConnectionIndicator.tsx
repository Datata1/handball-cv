import { useStatusStreamState } from '../sse'
import { ConnectionIndicator } from './ConnectionIndicator'

/** `ConnectionIndicator` wired to the app's stream. */
export function LiveConnectionIndicator({ className }: { className?: string }) {
  return <ConnectionIndicator state={useStatusStreamState()} className={className} />
}
