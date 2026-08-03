import { defineEventHandler } from 'h3'
import { getAuth, getDatabase } from '../../utils/auth.js'
import {
  requireGearPlanSameOrigin,
  requireGearPlanUserId,
} from '../../utils/gear-plan-api.js'
import {
  getPublicBuildShareOutcome,
  normalizePublicBuildRouteError,
  publicBuildOutcome,
  publishGearPlan,
  readPublicBuildShareBody,
  setPublicBuildCacheHeaders,
  writePublicBuildOutcome,
} from '../../utils/public-build-api.js'

export function createGearPlanSharePostHandler({
  expectedOrigin,
  getAuthInstance = getAuth,
  getDatabaseInstance = getDatabase,
  writeOutcome = writePublicBuildOutcome,
} = {}) {
  return defineEventHandler(async (event) => {
    setPublicBuildCacheHeaders(event, { privateResponse: true })

    try {
      const auth = getAuthInstance()
      requireGearPlanSameOrigin(event, auth, expectedOrigin)
      const userId = await requireGearPlanUserId(event, auth)
      await readPublicBuildShareBody(event)
      const publication = await publishGearPlan({
        db: getDatabaseInstance(),
        userId,
      })
      writeOutcome(publicBuildOutcome.shareReady)
      return publication
    }
    catch (error) {
      const normalizedError = normalizePublicBuildRouteError(error)
      writeOutcome(getPublicBuildShareOutcome(normalizedError))
      throw normalizedError
    }
  })
}

export default createGearPlanSharePostHandler()
