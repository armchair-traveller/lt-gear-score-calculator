import {
  createError,
  getRequestHeader,
  isError,
  setResponseHeader,
} from 'h3'
import { eq } from 'drizzle-orm'
import { user } from '../db/auth-schema.js'
import { gearPlan } from '../db/gear-plan-schema.js'
import { gearPlanShare } from '../db/gear-plan-share-schema.js'
import { formatGearPlanSnapshot, readRequestBodyWithLimit } from './gear-plan-api.js'

export const publicBuildEmptyCode = 'PUBLIC_BUILD_EMPTY'
export const publicBuildNotFoundCode = 'PUBLIC_BUILD_NOT_FOUND'
export const publicBuildUnavailableCode = 'PUBLIC_BUILD_UNAVAILABLE'
export const publicBuildShareBodyLimitBytes = 256
export const publicBuildSlugMaxLength = 64

const publicBuildSlugBaseFallback = 'player'
const publicBuildSlugCollisionLimit = 10_000
const publicBuildSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const publicBuildOutcome = Object.freeze({
  readFound: 'PUBLIC_BUILD_READ_FOUND',
  readNotFound: 'PUBLIC_BUILD_READ_NOT_FOUND',
  readUnavailable: 'PUBLIC_BUILD_READ_UNAVAILABLE',
  shareAuthRequired: 'PUBLIC_BUILD_SHARE_AUTH_REQUIRED',
  shareEmpty: 'PUBLIC_BUILD_SHARE_EMPTY',
  shareOriginRejected: 'PUBLIC_BUILD_SHARE_ORIGIN_REJECTED',
  shareReady: 'PUBLIC_BUILD_SHARE_READY',
  shareRejected: 'PUBLIC_BUILD_SHARE_REJECTED',
  shareUnavailable: 'PUBLIC_BUILD_SHARE_UNAVAILABLE',
})

export function writePublicBuildOutcome(outcome) {
  if (!Object.values(publicBuildOutcome).includes(outcome)) {
    throw new TypeError('Unknown public build outcome code.')
  }

  console.info(`[public-build] ${outcome}`)
}

export function setPublicBuildCacheHeaders(event, { privateResponse = false } = {}) {
  setResponseHeader(
    event,
    'cache-control',
    privateResponse ? 'private, no-store' : 'no-store',
  )
  setResponseHeader(event, 'pragma', 'no-cache')
}

export function normalizePublicBuildSlugBase(displayName) {
  const normalized = typeof displayName === 'string'
    ? displayName
        .normalize('NFKD')
        .replace(/\p{Mark}+/gu, '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : ''

  return normalized.slice(0, publicBuildSlugMaxLength).replace(/-+$/g, '')
    || publicBuildSlugBaseFallback
}

export function createPublicBuildSlugCandidate(base, collisionNumber = 1) {
  if (!Number.isSafeInteger(collisionNumber) || collisionNumber < 1) {
    throw new TypeError('Public build collision number must be a positive integer.')
  }

  const normalizedBase = normalizePublicBuildSlugBase(base)
  const suffix = collisionNumber === 1 ? '' : `-${collisionNumber}`
  const availableBaseLength = publicBuildSlugMaxLength - suffix.length
  const truncatedBase = normalizedBase
    .slice(0, availableBaseLength)
    .replace(/-+$/g, '') || publicBuildSlugBaseFallback

  return `${truncatedBase}${suffix}`
}

export function isValidPublicBuildSlug(slug) {
  return typeof slug === 'string'
    && slug.length <= publicBuildSlugMaxLength
    && publicBuildSlugPattern.test(slug)
}

function createPublicBuildEmptyError() {
  return createError({
    statusCode: 409,
    statusMessage: 'Add gear to the saved cloud plan before sharing it.',
    data: {
      code: publicBuildEmptyCode,
    },
  })
}

function createPublicBuildNotFoundError() {
  return createError({
    statusCode: 404,
    statusMessage: 'Public build not found.',
    data: {
      code: publicBuildNotFoundCode,
    },
  })
}

export function normalizePublicBuildRouteError(error) {
  if (isError(error)) {
    return error
  }

  return createError({
    statusCode: 503,
    statusMessage: 'Public builds are temporarily unavailable.',
    data: {
      code: publicBuildUnavailableCode,
    },
  })
}

function createPublicBuildShareBodyTooLargeError() {
  return createError({
    statusCode: 413,
    statusMessage: 'Public build share request is too large.',
  })
}

export async function readPublicBuildShareBody(event) {
  const contentType = getRequestHeader(event, 'content-type') || ''
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw createError({
      statusCode: 415,
      statusMessage: 'Public build sharing must use application/json.',
    })
  }

  const contentLength = getRequestHeader(event, 'content-length')
  if (
    contentLength
    && Number.isFinite(Number(contentLength))
    && Number(contentLength) > publicBuildShareBodyLimitBytes
  ) {
    throw createPublicBuildShareBodyTooLargeError()
  }

  let rawBody
  try {
    rawBody = await readRequestBodyWithLimit(event, publicBuildShareBodyLimitBytes)
  }
  catch (error) {
    if (isError(error) && error.statusCode === 413) {
      throw createPublicBuildShareBodyTooLargeError()
    }
    throw error
  }

  if (!rawBody || rawBody.byteLength === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public build share body is required.',
    })
  }

  let body
  try {
    body = JSON.parse(rawBody.toString('utf8'))
  }
  catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public build share request contains invalid JSON.',
    })
  }

  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).length > 0
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Public build share body must be an empty JSON object.',
    })
  }

  return body
}

async function readPublishableGearPlan(db, userId) {
  const [row] = await db
    .select({
      displayName: user.name,
      existingSlug: gearPlanShare.slug,
      plan: gearPlan.plan,
      revision: gearPlan.revision,
      schemaVersion: gearPlan.schemaVersion,
      updatedAt: gearPlan.updatedAt,
    })
    .from(gearPlan)
    .innerJoin(user, eq(gearPlan.userId, user.id))
    .leftJoin(gearPlanShare, eq(gearPlan.userId, gearPlanShare.userId))
    .where(eq(gearPlan.userId, userId))
    .limit(1)

  if (!row) {
    throw createPublicBuildEmptyError()
  }

  const snapshot = formatGearPlanSnapshot(row)

  if (Object.keys(snapshot.plan.slots).length === 0) {
    throw createPublicBuildEmptyError()
  }

  if (row.existingSlug && !isValidPublicBuildSlug(row.existingSlug)) {
    throw new TypeError('Stored public build slug is invalid.')
  }

  return {
    displayName: row.displayName,
    existingSlug: row.existingSlug,
  }
}

async function readExistingPublicBuildSlug(db, userId) {
  const [row] = await db
    .select({ slug: gearPlanShare.slug })
    .from(gearPlanShare)
    .where(eq(gearPlanShare.userId, userId))
    .limit(1)

  if (row && !isValidPublicBuildSlug(row.slug)) {
    throw new TypeError('Stored public build slug is invalid.')
  }

  return row?.slug || null
}

export async function publishGearPlan({ db, userId }) {
  const publication = await readPublishableGearPlan(db, userId)
  if (publication.existingSlug) {
    return {
      slug: publication.existingSlug,
      path: `/build/${publication.existingSlug}`,
    }
  }

  const slugBase = normalizePublicBuildSlugBase(publication.displayName)
  for (
    let collisionNumber = 1;
    collisionNumber <= publicBuildSlugCollisionLimit;
    collisionNumber += 1
  ) {
    const slug = createPublicBuildSlugCandidate(slugBase, collisionNumber)
    const inserted = await db
      .insert(gearPlanShare)
      .values({ userId, slug })
      .onConflictDoNothing()
      .returning({ slug: gearPlanShare.slug })

    if (inserted[0]) {
      return {
        slug,
        path: `/build/${slug}`,
      }
    }

    const existingSlug = await readExistingPublicBuildSlug(db, userId)
    if (existingSlug) {
      return {
        slug: existingSlug,
        path: `/build/${existingSlug}`,
      }
    }
  }

  throw new Error('Public build slug allocation limit reached.')
}

function formatPublicBuildOwner(displayName, image) {
  const normalizedDisplayName = typeof displayName === 'string'
    ? displayName.trim()
    : ''
  if (
    !normalizedDisplayName
    || normalizedDisplayName.length > 128
    || /[\u0000-\u001f\u007f]/u.test(normalizedDisplayName)
  ) {
    throw new TypeError('Stored public build display name is invalid.')
  }

  return {
    displayName: normalizedDisplayName,
    image: getPublicDiscordAvatar(image),
  }
}

function getPublicDiscordAvatar(image) {
  if (typeof image !== 'string' || !image || image.length > 2_048) {
    return null
  }

  try {
    const imageURL = new URL(image)
    if (
      imageURL.origin !== 'https://cdn.discordapp.com'
      || !['/avatars/', '/embed/avatars/'].some(prefix =>
        imageURL.pathname.startsWith(prefix),
      )
    ) {
      return null
    }
  }
  catch {
    return null
  }

  return image
}

export async function readPublicGearPlan(db, slug) {
  if (!isValidPublicBuildSlug(slug)) {
    throw createPublicBuildNotFoundError()
  }

  const [row] = await db
    .select({
      displayName: user.name,
      image: user.image,
      plan: gearPlan.plan,
      revision: gearPlan.revision,
      schemaVersion: gearPlan.schemaVersion,
      updatedAt: gearPlan.updatedAt,
    })
    .from(gearPlanShare)
    .innerJoin(gearPlan, eq(gearPlanShare.userId, gearPlan.userId))
    .innerJoin(user, eq(gearPlan.userId, user.id))
    .where(eq(gearPlanShare.slug, slug))
    .limit(1)

  if (!row) {
    throw createPublicBuildNotFoundError()
  }

  const snapshot = formatGearPlanSnapshot(row)
  return {
    owner: formatPublicBuildOwner(row.displayName, row.image),
    plan: snapshot.plan,
    updatedAt: snapshot.updatedAt,
  }
}

export function getPublicBuildShareOutcome(error) {
  if (error?.statusCode === 401) {
    return publicBuildOutcome.shareAuthRequired
  }
  if (error?.statusCode === 403) {
    return publicBuildOutcome.shareOriginRejected
  }
  if (error?.data?.code === publicBuildEmptyCode) {
    return publicBuildOutcome.shareEmpty
  }
  if (error?.data?.code === publicBuildUnavailableCode) {
    return publicBuildOutcome.shareUnavailable
  }
  return publicBuildOutcome.shareRejected
}

export function getPublicBuildReadOutcome(error) {
  return error?.data?.code === publicBuildNotFoundCode
    ? publicBuildOutcome.readNotFound
    : publicBuildOutcome.readUnavailable
}
