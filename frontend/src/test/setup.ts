// Vitest setup file (see vite.config.ts's `test.setupFiles`) — same pattern as
// `sheets-app/src/test/setup.ts`. Registers jest-dom's matchers (toBeInTheDocument/
// toHaveTextContent/etc) onto Vitest's `expect` as a side effect of this import — no globals,
// matching this project's existing explicit-import convention for `.spec.ts` files
// (`import { describe, expect, it } from 'vitest'`).
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// This project doesn't enable Vitest's `test.globals`, so `@testing-library/react`'s automatic
// per-test cleanup (which relies on a global `afterEach`) never registers itself — do it here,
// once, for every component test in the workspace.
afterEach(() => {
    cleanup()
})
