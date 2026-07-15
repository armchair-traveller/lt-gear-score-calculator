import { inject, provide } from 'vue'

const appShellKey = Symbol('appShell')

export function provideAppShell() {
  const helpHandlers = new Map()

  function registerHelpHandler(routeKey, handler) {
    helpHandlers.set(routeKey, handler)

    return () => {
      if (helpHandlers.get(routeKey) === handler) {
        helpHandlers.delete(routeKey)
      }
    }
  }

  function openHelp(routeKey) {
    helpHandlers.get(routeKey)?.()
  }

  const appShell = {
    registerHelpHandler,
    openHelp,
  }

  provide(appShellKey, appShell)
  return appShell
}

export function useAppShellContext() {
  const appShell = inject(appShellKey)

  if (!appShell) {
    throw new Error('App shell context is missing.')
  }

  return appShell
}
