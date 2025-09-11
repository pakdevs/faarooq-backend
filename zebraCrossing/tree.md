Project structure (September 6, 2025)

Note: node_modules omitted for brevity.

faarook/
├─ open.md — workspace notes
├─ zebraCrossing/
│ ├─ blueprint.md — master blueprint and roadmap
│ ├─ implemented.md — phase 1 progress log
│ └─ tree.md — this project structure
└─ backend/
├─ .env — local env (ignored)
├─ .gitignore — ignores .env, dist, node_modules
├─ package.json — scripts & dependencies
├─ package-lock.json — lockfile
├─ tsconfig.json — TypeScript config
├─ sql/
│ ├─ schema.sql — Supabase tables, indexes, RLS (idempotent)
│ └─ seed.sql — sample data (idempotent)
└─ src/
├─ server.ts — Express app setup and route mounting
├─ lib/
│ └─ supabase.ts — Supabase client initialization
├─ middleware/
│ └─ auth.ts — JWT auth middleware
├─ routes/
│ ├─ auth.ts — signup/login token issuance (stub)
│ ├─ users.ts — user profile read
│ ├─ posts.ts — create/list/update/delete posts; followed feed
│ ├─ follows.ts — follow/unfollow (idempotent)
│ ├─ likes.ts — like/repost (idempotent)
│ └─ notifications.ts — list/mark-read with cursor
├─ utils/
│ └─ pagination.ts — cursor pagination helper
└─ types/
└─ models.ts — shared domain types
