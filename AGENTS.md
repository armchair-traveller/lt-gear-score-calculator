# AGENTS.md

- Nuxt 4 + Vue 3 SPA (`ssr: false`) using Nuxt's default `app/` directory. JavaScript only
- Styling uses Tailwind CSS v4, shadcn-vue/Reka UI components, and lucide icons.
- Main calculator code lives in `app/features/gear-score/`; keep scoring math in `score-calculation.js` and state/UI orchestration in composables/components.
- Core data lives in `app/utils/gear.js`, `app/utils/tiers.js`, and `app/data/item-enhancement-materials.en.json`; update data files instead of hardcoding data exceptions in components.
- Reuse `app/components/ui/` primitives before adding new UI patterns.
