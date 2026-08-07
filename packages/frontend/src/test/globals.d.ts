// vitest runs with `globals: true` (see vitest.config.ts) so composeStories
// tests read without a describe/it/expect import line in every file. This
// reference is what tells tsc those globals exist.
/// <reference types="vitest/globals" />
