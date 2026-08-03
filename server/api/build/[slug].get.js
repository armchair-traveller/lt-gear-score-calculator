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
      return createPublicBuildErrorResponse(normalizedError)
    }
  })
}

function createPublicBuildErrorResponse(error) {
  return Response.json(
    {
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      data: error.data,
    },
    {
      status: error.statusCode,
      headers: {
        'cache-control': 'private, no-store',
        pragma: 'no-cache',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
      },
    },
  )
}

export default createPublicBuildGetHandler()
