# AGENTS.md

- Vite + Vue 3 SPA. JavaScript only; use Vue SFCs with `<script setup>`.
- Styling uses Tailwind CSS v4, shadcn-vue/Reka UI components, and lucide icons.
- Commands: `npm ci`, `npm run dev`, `npm run build`, `npm run preview`.
- No lint/test scripts are configured; run `npm run build` as minimum verification.
- `App.vue` path-switches between `/` (`src/pages/GearScore.vue`) and `/upgrade` (`src/pages/Upgrade.vue`).
- Main calculator code lives in `src/features/gear-score/`; keep scoring math in `score-calculation.js` and state/UI orchestration in composables/components.
- Core data lives in `src/utils/gear.js`, `src/utils/tiers.js`, and `src/data/item-enhancement-materials.en.json`; update data files instead of hardcoding data exceptions in components.
- Prefer `@/` imports, 2-space indentation, single quotes, and no semicolons in app code.
- Reuse `src/components/ui/` primitives before adding new UI patterns.
- Do not hand-edit `dist/`.
