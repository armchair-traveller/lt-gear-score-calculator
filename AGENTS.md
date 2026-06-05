# AGENTS.md

- Nuxt 4 + Vue 3 SPA (`ssr: false`) using Nuxt's default `app/` directory. JavaScript only; use Vue SFCs with `<script setup>`.
- Styling uses Tailwind CSS v4, shadcn-vue/Reka UI components, and lucide icons.
- Commands: `npm ci`, `npm run dev`, `npm run build`, `npm run preview`.
- No lint/test scripts are configured; run `npm run build` as minimum verification.
- Nuxt file routing maps `/` (`app/pages/index.vue`), `/upgrade` (`app/pages/upgrade.vue`), and `/plan` (`app/pages/plan.vue`).
- Main calculator code lives in `app/features/gear-score/`; keep scoring math in `score-calculation.js` and state/UI orchestration in composables/components.
- Core data lives in `app/utils/gear.js`, `app/utils/tiers.js`, and `app/data/item-enhancement-materials.en.json`; update data files instead of hardcoding data exceptions in components.
- Prefer `@/` imports, 2-space indentation, single quotes, and no semicolons in app code.
- Reuse `app/components/ui/` primitives before adding new UI patterns.
- Do not hand-edit generated output (`dist/`, `.nuxt/`, or `.output/`).
