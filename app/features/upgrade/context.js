import { inject, provide } from 'vue'

const upgradePlannerKey = Symbol('upgradePlanner')

export function provideUpgradePlanner(planner) {
  provide(upgradePlannerKey, planner)
}

export function useUpgradePlannerContext() {
  const planner = inject(upgradePlannerKey)

  if (!planner) {
    throw new Error('Upgrade planner context is missing.')
  }

  return planner
}
