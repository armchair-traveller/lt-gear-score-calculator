export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client && document.startViewTransition) {
    to.meta.pageTransition = false
    to.meta.layoutTransition = false
  }
})
