import {
  appendResponseHeader,
  createError,
  getRequestHeader,
  getRequestHeaders,
  isError,
  setResponseHeader,
} from 'h3'
import { and, eq } from 'drizzle-orm'
import {
  GearPlanValidationError,
  gearPlanValidationCode,
  gearPlanValidationMessage,
  parseGearPlanStrict,
} from '../../app/features/gear-plan/plan-validation.js'
import { gearPlan } from '../db/gear-plan-schema.js'

export const gearPlanConflictCode = 'GEAR_PLAN_CONFLICT'
export const gearPlanUnavailableCode = 'GEAR_PLAN_UNAVAILABLE'
export const gearPlanBodyLimitBytes = 32 * 1024

export function setGearPlanCacheHeaders(event) {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  setResponseHeader(event, 'pragma', 'no-cache')
}

export function normalizeGearPlanRouteError(error) {
  if (isError(error)) {
    return error
  }

  return createError({
    statusCode: 503,
    statusMessage: 'Cloud planner is temporarily unavailable.',
    data: {
      code: gearPlanUnavailableCode,
    },
  })
}

function appendSessionCookies(event, headers) {
  if (!headers) {
    return
  }

  const cookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : []
  for (const cookie of cookies) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }
}

export async function requireGearPlanUserId(event, auth) {
  let result
  try {
    result = await auth.api.getSession({
      headers: new Headers(getRequestHeaders(event)),
      query: {
        disableCookieCache: true,
      },
      returnHeaders: true,
    })
  }
  catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Account data is temporarily unavailable.',
      data: {
        code: gearPlanUnavailableCode,
      },
    })
  }

  appendSessionCookies(event, result.headers)

  const userId = result.response?.user?.id
  if (typeof userId !== 'string' || !userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sign in to use cloud planner storage.',
    })
  }

  return userId
}

export function requireGearPlanSameOrigin(event, auth, expectedOrigin) {
  const trustedOrigin = expectedOrigin || new URL(auth.options.baseURL).origin
  if (getRequestHeader(event, 'origin') !== trustedOrigin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Cross-origin planner updates are not allowed.',
    })
  }
}

function createGearPlanBodyTooLargeError() {
  return createError({
    statusCode: 413,
    statusMessage: 'Planner update is too large.',
  })
}

function toBodyChunk(value) {
  if (Buffer.isBuffer(value)) {
    return value
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'utf8')
  }
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value)
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }
  return Buffer.from(value)
}

function assertBodyChunkFits(totalBytes, chunk, maxBytes) {
  const nextTotal = totalBytes + chunk.byteLength
  if (nextTotal > maxBytes) {
    throw createGearPlanBodyTooLargeError()
  }
  return nextTotal
}

async function readWebBodyWithLimit(stream, maxBytes) {
  const reader = stream.getReader()
  const chunks = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const chunk = toBodyChunk(value)
      try {
        totalBytes = assertBodyChunkFits(totalBytes, chunk, maxBytes)
      }
      catch (error) {
        await reader.cancel().catch(() => {})
        throw error
      }
      chunks.push(chunk)
    }
  }
  finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, totalBytes)
}

async function readAsyncBodyWithLimit(stream, maxBytes) {
  const iterator = stream[Symbol.asyncIterator]()
  const chunks = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await iterator.next()
    if (done) {
      break
    }

    const chunk = toBodyChunk(value)
    try {
      totalBytes = assertBodyChunkFits(totalBytes, chunk, maxBytes)
    }
    catch (error) {
      await iterator.return?.()
      throw error
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks, totalBytes)
}

function readNodeBodyWithLimit(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0
    let settled = false

    function removeReadListeners() {
      request.off('data', onData)
      request.off('end', onEnd)
      request.off('error', onError)
    }

    function finishDrain() {
      request.off('end', finishDrain)
      request.off('close', finishDrain)
      request.off('error', onDrainError)
    }

    function onDrainError() {
      finishDrain()
    }

    function drainRemainingBody() {
      request.once('end', finishDrain)
      request.once('close', finishDrain)
      request.on('error', onDrainError)
      request.resume()
    }

    function onData(value) {
      const chunk = toBodyChunk(value)
      const nextTotal = totalBytes + chunk.byteLength
      if (nextTotal > maxBytes) {
        settled = true
        removeReadListeners()
        drainRemainingBody()
        reject(createGearPlanBodyTooLargeError())
        return
      }

      totalBytes = nextTotal
      chunks.push(chunk)
    }

    function onEnd() {
      if (settled) {
        return
      }
      settled = true
      removeReadListeners()
      resolve(Buffer.concat(chunks, totalBytes))
    }

    function onError(error) {
      if (settled) {
        return
      }
      settled = true
      removeReadListeners()
      reject(error)
    }

    request.on('data', onData)
    request.once('end', onEnd)
    request.once('error', onError)
  })
}

async function readMaterializedBodyWithLimit(source, maxBytes) {
  const value = await source
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value.getReader === 'function') {
    return readWebBodyWithLimit(value, maxBytes)
  }
  if (typeof value[Symbol.asyncIterator] === 'function') {
    return readAsyncBodyWithLimit(value, maxBytes)
  }

  let bodyValue = value
  if (value.constructor === Object) {
    bodyValue = JSON.stringify(value)
  }
  else if (value instanceof URLSearchParams) {
    bodyValue = value.toString()
  }

  const body = toBodyChunk(bodyValue)
  if (body.byteLength > maxBytes) {
    throw createGearPlanBodyTooLargeError()
  }
  return body
}

async function readGearPlanBodyWithLimit(event, maxBytes) {
  const request = event.node?.req
  const rawBodySymbol = Symbol.for('h3RawBody')
  const materializedBody = event._requestBody
    ?? event.web?.request?.body
    ?? request?.[rawBodySymbol]
    ?? request?.rawBody
    ?? request?.body

  if (materializedBody !== undefined && materializedBody !== null) {
    return readMaterializedBodyWithLimit(materializedBody, maxBytes)
  }
  if (!request) {
    return undefined
  }
  if (request.readableEnded) {
    return Buffer.alloc(0)
  }

  return readNodeBodyWithLimit(request, maxBytes)
}

export async function readGearPlanPutBody(event) {
  const contentType = getRequestHeader(event, 'content-type') || ''
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw createError({
      statusCode: 415,
      statusMessage: 'Planner updates must use application/json.',
    })
  }

  const contentLength = getRequestHeader(event, 'content-length')
  if (
    contentLength
    && Number.isFinite(Number(contentLength))
    && Number(contentLength) > gearPlanBodyLimitBytes
  ) {
    throw createGearPlanBodyTooLargeError()
  }

  const rawBody = await readGearPlanBodyWithLimit(event, gearPlanBodyLimitBytes)
  if (!rawBody || rawBody.byteLength === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Planner update body is required.',
    })
  }

  let body
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Planner update contains invalid JSON.',
    })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Planner update body is invalid.',
    })
  }

  const expectedRevision = body.expectedRevision
  if (
    !Number.isSafeInteger(expectedRevision)
    || expectedRevision < 0
    || expectedRevision >= Number.MAX_SAFE_INTEGER
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Planner revision is invalid.',
    })
  }

  let plan
  try {
    plan = parseGearPlanStrict(body.plan)
  }
  catch (error) {
    if (!(error instanceof GearPlanValidationError)) {
      throw error
    }

    throw createError({
      statusCode: 422,
      statusMessage: gearPlanValidationMessage,
      data: {
        code: gearPlanValidationCode,
      },
    })
  }

  return {
    expectedRevision,
    plan,
  }
}

function formatUpdatedAt(updatedAt) {
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt)
  if (!Number.isFinite(date.getTime())) {
    throw new TypeError('Stored planner timestamp is invalid.')
  }
  return date.toISOString()
}

export function formatGearPlanSnapshot(row) {
  if (!row) {
    return {
      plan: null,
      revision: 0,
      updatedAt: null,
    }
  }

  const plan = parseGearPlanStrict(row.plan)
  if (row.schemaVersion !== plan.version) {
    throw new TypeError('Stored planner schema version does not match its payload.')
  }
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new TypeError('Stored planner revision is invalid.')
  }

  return {
    plan,
    revision: row.revision,
    updatedAt: formatUpdatedAt(row.updatedAt),
  }
}

export async function readGearPlanSnapshot(db, userId) {
  const [row] = await db
    .select({
      schemaVersion: gearPlan.schemaVersion,
      plan: gearPlan.plan,
      revision: gearPlan.revision,
      updatedAt: gearPlan.updatedAt,
    })
    .from(gearPlan)
    .where(eq(gearPlan.userId, userId))
    .limit(1)

  return formatGearPlanSnapshot(row)
}

export async function writeGearPlanSnapshot({
  db,
  userId,
  plan,
  expectedRevision,
}) {
  const updatedAt = new Date()
  let rows

  if (expectedRevision === 0) {
    rows = await db
      .insert(gearPlan)
      .values({
        userId,
        schemaVersion: plan.version,
        plan,
        revision: 1,
        updatedAt,
      })
      .onConflictDoNothing({ target: gearPlan.userId })
      .returning()
  }
  else {
    rows = await db
      .update(gearPlan)
      .set({
        schemaVersion: plan.version,
        plan,
        revision: expectedRevision + 1,
        updatedAt,
      })
      .where(and(
        eq(gearPlan.userId, userId),
        eq(gearPlan.revision, expectedRevision),
      ))
      .returning()
  }

  if (rows[0]) {
    return formatGearPlanSnapshot(rows[0])
  }

  const cloud = await readGearPlanSnapshot(db, userId)
  throw createError({
    statusCode: 409,
    statusMessage: 'Cloud planner changed in another session.',
    data: {
      code: gearPlanConflictCode,
      cloud,
    },
  })
}
