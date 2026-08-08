import { configure } from 'mobx'

// The `*RequiresReaction` checks warn when an observable or computed is read
// outside a reaction — a component that forgot `observer()`. Off under vitest,
// where store tests read state directly by design and every assertion would
// print one.
const diagnoseWiring = import.meta.env.MODE !== 'test'

// Imported for its side effect by every store module: configure() has to run
// before the first makeAutoObservable().
configure({
  // Mutating an observed field outside an action throws, instead of silently
  // not re-rendering.
  enforceActions: 'observed',
  computedRequiresReaction: diagnoseWiring,
  observableRequiresReaction: diagnoseWiring,
  reactionRequiresObservable: diagnoseWiring,
  disableErrorBoundaries: false,
})
