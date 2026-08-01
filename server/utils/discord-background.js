import { waitUntil as vercelWaitUntil } from '@vercel/functions'

export function registerDiscordBackgroundTask(
  event,
  promise,
  {
    isVercel = Boolean(process.env.VERCEL),
    vercelWaitUntilImpl = vercelWaitUntil,
  } = {},
) {
  let registered = false
  if (typeof event?.waitUntil === 'function') {
    event.waitUntil(promise)
    registered = true
  }

  if (isVercel) {
    vercelWaitUntilImpl(promise)
    registered = true
  }

  if (!registered) {
    throw new Error('This server runtime does not support background request work.')
  }
}
