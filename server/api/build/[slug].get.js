import { defineEventHandler, getRouterParam } from 'h3'
import { getDatabase } from '../../utils/auth.js'
import {
  getPublicBuildReadOutcome,
  normalizePublicBuildRouteError,
  publicBuildOutcome,
  readPublicGearPlan,
  setPublicBuildCacheHeaders,
  writePublicBuildOutcome,
} from '../../utils/public-build-api.js'

export function createPublicBuildGetHandler({
  getDatabaseInstance = getDatabase,
  getSlug = event => getRouterParam(event, 'slug'),
  writeOutcome = writePublicBuildOutcome,
} = {}) {
  return defineEventHandler(async (event) => {
    setPublicBuildCacheHeaders(event, { privateResponse: true })

    try {
      const publicBuild = await readPublicGearPlan(
        getDatabaseInstance(),
        getSlug(event),
      )
      writeOutcome(publicBuildOutcome.readFound)
      return publicBuild
    }
    catch (error) {
      const normalizedError = normalizePublicBuildRouteError(error)
      writeOutcome(getPublicBuildReadOutcome(normalizedError))
      throw normalizedError
    }
  })
}

export default createPublicBuildGetHandler()
