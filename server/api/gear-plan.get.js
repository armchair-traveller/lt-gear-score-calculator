import { defineEventHandler } from 'h3'
import { getAuth, getDatabase } from '../utils/auth.js'
import {
  normalizeGearPlanRouteError,
  readGearPlanSnapshot,
  requireGearPlanUserId,
  setGearPlanCacheHeaders,
} from '../utils/gear-plan-api.js'

export function createGearPlanGetHandler({
  getAuthInstance = getAuth,
  getDatabaseInstance = getDatabase,
} = {}) {
  return defineEventHandler(async (event) => {
    setGearPlanCacheHeaders(event)

    try {
      const auth = getAuthInstance()
      const userId = await requireGearPlanUserId(event, auth)
      return await readGearPlanSnapshot(getDatabaseInstance(), userId)
    }
    catch (error) {
      throw normalizeGearPlanRouteError(error)
    }
  })
}

export default createGearPlanGetHandler()
