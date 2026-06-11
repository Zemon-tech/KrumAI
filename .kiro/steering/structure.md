# Project Structure

```
krumstudio/
├── app/                        # Next.js App Router
│   ├── api/                    # Route Handlers (server-side)
│   │   └── generate/
│   │       ├── dispatch/       # POST — validates + dispatches to ComfyUI
│   │       │   └── route.ts
│   │       └── persist/        # POST — pipes ComfyUI output to S3
│   │           └── route.ts
│   ├── playground/             # Studio canvas page
│   │   └── page.tsx
│   ├── globals.css             # Tailwind base styles + shadcn CSS vars
│   ├── layout.tsx              # Root layout (fonts, ThemeProvider)
│   └── page.tsx                # Home/landing page
│
├── components/
│   ├── ui/                     # shadcn/ui components (auto-generated, do not hand-edit)
│   └── ai-elements/            # AI Elements components (installed via npx ai-elements@latest add)
│
├── hooks/                      # Custom React hooks (e.g. use-mobile.ts)
│
├── lib/
│   ├── comfy-templates/        # ComfyUI workflow JSON files (t2i.json, t2v.json, etc.)
│   ├── comfyGraphParser.ts     # Runtime node/input injection for ComfyUI workflows
│   ├── s3Client.ts             # AWS S3 client setup
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
│
├── public/                     # Static assets
├── .kiro/steering/             # AI steering documents
├── .agents/skills/             # AI Elements skill references
├── components.json             # shadcn/ui config (style: radix-nova, aliases)
├── next.config.ts              # Next.js config
├── tsconfig.json               # TypeScript config (strict, paths: @/* → ./)
├── eslint.config.mjs           # ESLint flat config
└── SPEC.md                     # Architecture specification
```

## Key Conventions

- **Route Handlers** live in `app/api/**/route.ts`. Use `export async function POST/GET`.
- **Server Components** are the default in `app/`. Add `"use client"` only when hooks/events are needed.
- **UI components** — always use `components/ui/` (shadcn). Install new ones with `npx shadcn@latest add <name>`.
- **AI Elements** — install with `npx ai-elements@latest add <name>`; files land in `components/ai-elements/`.
- **Shared utilities** go in `lib/`. The `cn()` helper from `lib/utils.ts` is the only way to merge classes.
- **Custom hooks** go in `hooks/` following the `use-*.ts` naming pattern.
- **ComfyUI workflow templates** (exported API JSON graphs) live in `lib/comfy-templates/`.
- **Environment config** — all secrets/URLs in `.env.local` only. Never commit secrets.
- **Imports** — use `@/` alias for all internal imports (e.g. `@/lib/utils`, `@/components/ui/button`).
