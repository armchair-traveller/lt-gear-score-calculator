export const authErrorPath = '/auth/error'

const authErrorMessages = Object.freeze({
  access_denied: {
    title: 'Discord sign-in was cancelled',
    description: 'No account changes were made. You can try again whenever you are ready.',
  },
  email_not_found: {
    title: 'Discord could not share your account details',
    description: 'Check your Discord account settings, then try signing in again.',
  },
  invalid_code: {
    title: 'That sign-in attempt expired',
    description: 'Start a fresh Discord sign-in to continue.',
  },
  no_code: {
    title: 'That sign-in attempt was incomplete',
    description: 'Start a fresh Discord sign-in to continue.',
  },
  state_invalid: {
    title: 'That sign-in attempt expired',
    description: 'Start a fresh Discord sign-in to continue.',
  },
  state_mismatch: {
    title: 'That sign-in attempt expired',
    description: 'Start a fresh Discord sign-in to continue.',
  },
  state_not_found: {
    title: 'That sign-in attempt expired',
    description: 'Start a fresh Discord sign-in to continue.',
  },
  unable_to_get_user_info: {
    title: 'Discord account details were unavailable',
    description: 'Discord did not return the profile details needed to sign you in. Please try again.',
  },
})

const defaultAuthErrorMessage = Object.freeze({
  title: 'We could not sign you in',
  description: 'Account access is temporarily unavailable. Your calculator data has not been changed.',
})

export function sanitizeAuthReturnTo(value, fallback = '/') {
  const safeFallback = sanitizeRelativeAppPath(fallback) || '/'
  return sanitizeRelativeAppPath(getFirstString(value)) || safeFallback
}

export function getAuthErrorCallbackURL(returnTo = '/') {
  const query = new URLSearchParams({
    returnTo: sanitizeAuthReturnTo(returnTo),
  })

  return `${authErrorPath}?${query.toString()}`
}

export function getAuthErrorMessage(value) {
  const code = normalizeAuthErrorCode(value)
  return authErrorMessages[code] || defaultAuthErrorMessage
}

function sanitizeRelativeAppPath(value) {
  const candidate = String(value || '').trim()
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
  ) {
    return ''
  }

  let url
  try {
    url = new URL(candidate, 'https://latale-tools.invalid')
  }
  catch {
    return ''
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(url.pathname).toLowerCase()
  }
  catch {
    return ''
  }

  if (
    decodedPath.startsWith('//')
    || decodedPath.includes('\\')
    || isPathOrChild(decodedPath, '/api/auth')
    || isPathOrChild(decodedPath, authErrorPath)
  ) {
    return ''
  }

  return `${url.pathname}${url.search}${url.hash}`
}

function isPathOrChild(path, blockedPath) {
  return path === blockedPath || path.startsWith(`${blockedPath}/`)
}

function getFirstString(value) {
  if (Array.isArray(value)) {
    return value.find(item => typeof item === 'string') || ''
  }

  return typeof value === 'string' ? value : ''
}

function normalizeAuthErrorCode(value) {
  return getFirstString(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
}
