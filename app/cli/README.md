# Chronosole terminal split

All files are meant to live in the same route/component folder.

## Main entry

- `page.tsx` is the Next.js route page and composition root.

## State and lifecycle

- `useTerminalTabs.ts` owns tab state, active tab state, refs, persistence, and close/add behavior.
- `useTerminalResources.ts` owns xterm bootstrapping, WebSocket wiring, resize behavior, theme patching, focus, and cleanup.
- `useTerminalShortcuts.ts` owns keyboard shortcuts.
- `useClock.ts` owns the header clock.

## UI components

- `TerminalHeader.tsx` renders title, tabs, connection status, clock, and theme toggle.
- `TerminalTabs.tsx` renders tab buttons and tab actions.
- `TerminalViewport.tsx` renders terminal mount containers.
- `TerminalFooter.tsx` renders the footer shortcut/status strip.

## Shared helpers

- `types.ts` contains shared TypeScript types.
- `constants.ts` contains storage keys and status display config.
- `terminalStorage.ts` contains session storage helpers and tab creation.
- `terminalTheme.ts` contains terminal theme/font helpers.
