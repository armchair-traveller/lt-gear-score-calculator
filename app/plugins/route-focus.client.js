import { normalizeAppRoutePath } from '@/utils/app-route.js'

export default defineNuxtPlugin((nuxtApp) => {
  const route = useRoute()
  let currentPath = normalizeAppRoutePath(route.path)

  async function focusRouteMain(path, attempt = 0) {
    await nextTick()
    await new Promise(requestAnimationFrame)

    if (path !== currentPath) {
      return
    }

    const routeMain = Array.from(document.querySelectorAll('[data-route-main]'))
      .find(element => element.dataset.routeMain === path)

    if (!routeMain && attempt < 30) {
      setTimeout(() => {
        void focusRouteMain(path, attempt + 1)
      }, 16)
      return
    }

    const openDialog = document.querySelector('[role="dialog"], [aria-modal="true"]')
    const focusIsInDialog = document.activeElement?.closest('[role="dialog"], [aria-modal="true"]')
    if (route.hash || openDialog || focusIsInDialog) {
      return
    }

    routeMain?.focus({ preventScroll: true })
  }

  nuxtApp.hook('page:finish', () => {
    const nextPath = normalizeAppRoutePath(route.path)
    if (nextPath === currentPath) {
      return
    }

    currentPath = nextPath
    void focusRouteMain(currentPath)
  })
})
