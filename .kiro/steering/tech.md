# Tech Stack

## Framework
- **Next.js 16.2.9** — App Router. This is a non-standard version with breaking changes. Read `node_modules/next/dist/docs/` before writing any Next.js code.
- **React 19.2.4** with TypeScript 5 (strict mode)
- **Node.js** target: ES2017

## UI Layer
- **shadcn/ui** (style: `radix-nova`) — component library installed via `npx shadcn@latest add`. Do NOT hand-write Radix primitives; use the shadcn wrappers in `components/ui/`.
- **Radix UI** (`radix-ui` v1 + `@base-ui/react` v1) — underlying primitives
- **Tailwind CSS v4** with `@tailwindcss/postcss`. CSS variables enabled (`cssVariables: true`). Global styles in `app/globals.css`.
- **`cn()` helper** — always use `cn()` from `@/lib/utils` (clsx + tailwind-merge) for conditional class names.
- **lucide-react** — icon library (configured as `iconLibrary` in components.json)
- **next-themes** — theme/dark-mode support

## AI & Streaming
- **Vercel AI SDK (`ai` v6)** — use `createStreamableValue`, `useChat`, `streamText`, `streamObject`, `convertToModelMessages`, `UIMessage`, etc.
- Backend routes use `result.toUIMessageStreamResponse()` for chat and `result.toTextStreamResponse()` for object streaming.

## Data Visualization
- **Recharts v3** — charts
- **date-fns v4** — date utilities

## Other Key Libraries
- **Zod** — schema validation & type inference
- **`class-variance-authority`** — component variants
- **`sonner`** — toast notifications
- **`cmdk`** — command palette
- **`embla-carousel-react`** — carousels
- **`vaul`** — drawer
- **`react-resizable-panels`** — resizable layouts

## Path Aliases
`@/*` maps to the project root. Use `@/components`, `@/lib`, `@/hooks`, `@/app`.

## Common Commands
```bash
npm run dev      # Start dev server (run manually — do not use in agent commands)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (flat config via eslint.config.mjs)
```

> Dev server and watchers must be started manually by the user — never run `npm run dev` in an automated command.
