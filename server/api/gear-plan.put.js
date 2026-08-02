import { defineEventHandler } from 'h3'
import { getAuth, getDatabase } from '../utils/auth.js'
import {
  normalizeGearPlanRouteError,
  readGearPlanPutBody,
  requireGearPlanSameOrigin,
  requireGearPlanUserId,
  setGearPlanCacheHeaders,
  writeGearPlanSnapshot,
} from '../utils/gear-plan-api.js'

export function createGearPlanPutHandler({
  expectedOrigin,
  getAuthInstance = getAuth,
  getDatabaseInstance = getDatabase,
} = {}) {
  return defineEventHandler(async (event) => {
    setGearPlanCacheHeaders(event)

    try {
      const auth = getAuthInstance()
      requireGearPlanSameOrigin(event, auth, expectedOrigin)
      const userId = await requireGearPlanUserId(event, auth)
      const { expectedRevision, plan } = await readGearPlanPutBody(event)

      return await writeGearPlanSnapshot({
        db: getDatabaseInstance(),
        userId,
        plan,
        expectedRevision,
      })
    }
    catch (error) {
      throw normalizeGearPlanRouteError(error)
    }
  })
}

export default createGearPlanPutHandler()
