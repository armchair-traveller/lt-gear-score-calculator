export const gearPlanStatusClasses = Object.freeze({
  info: 'border-info-border bg-info-surface text-info-foreground',
  opportunity: 'border-warning-border bg-warning-surface text-warning-foreground',
  complete: 'border-success-border bg-success-surface text-success-foreground',
  neutral: 'border-border bg-surface-inset text-muted-foreground',
})

export function getGearPlanLineStatusClass(status) {
  if (status === 'penta') {
    return gearPlanStatusClasses.complete
  }
  if (status === 'partial') {
    return gearPlanStatusClasses.info
  }
  return gearPlanStatusClasses.neutral
}

export function getGearPlanOpportunityStatusClass(opportunityDI) {
  return opportunityDI > 0.0001
    ? gearPlanStatusClasses.opportunity
    : gearPlanStatusClasses.complete
}

export function getGearPlanOpportunityTextClass(opportunityDI) {
  return opportunityDI > 0.0001
    ? 'text-warning-foreground'
    : 'text-success-foreground'
}
