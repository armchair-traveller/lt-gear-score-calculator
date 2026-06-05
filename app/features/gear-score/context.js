import { inject, provide } from 'vue'

const gearScoreCalculatorKey = Symbol('gearScoreCalculator')

export function provideGearScoreCalculator(calculator) {
  provide(gearScoreCalculatorKey, calculator)
}

export function useGearScoreCalculatorContext() {
  const calculator = inject(gearScoreCalculatorKey)

  if (!calculator) {
    throw new Error('Gear score calculator context is missing.')
  }

  return calculator
}
