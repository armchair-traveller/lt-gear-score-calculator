import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2026-06-13',
  experimental: {
    viewTransition: true,
  },
  components: [
    { path: '~/components', pathPrefix: false, extensions: ['.vue'] },
    { path: '~/features/gear-score/components', pathPrefix: false, extensions: ['.vue'] },
    { path: '~/features/gear-plan/components', pathPrefix: false, extensions: ['.vue'] },
  ],
  imports: {
    dirs: [
      '~/features/*/context.js',
      '~/features/*/use*.js',
    ],
  },
  css: ['~/styles/main.css'],
  app: {
    pageTransition: {
      name: 'motion-swap',
      mode: 'out-in',
    },
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      title: 'LaTale Enchant Calculator',
      link: [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      ],
      script: [
        {
          key: 'color-mode-init',
          innerHTML: `(function () {
            try {
              var mode = localStorage.getItem('vueuse-color-scheme') || 'auto'
              var isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
              document.documentElement.classList.toggle('dark', isDark)
            } catch (_) {}
          })()`,
          tagPosition: 'head',
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
