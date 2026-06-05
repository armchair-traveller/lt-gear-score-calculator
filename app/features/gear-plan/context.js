import { inject, provide } from 'vue'

const gearPlanKey = Symbol('gearPlan')

export function provideGearPlan(plan) {
  provide(gearPlanKey, plan)
}

export function useGearPlanContext() {
  const plan = inject(gearPlanKey)
  if (!plan) {
    throw new Error('Gear plan context is missing.')
  }

  return plan
}
