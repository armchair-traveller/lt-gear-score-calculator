import { defineEventHandler, toWebRequest } from 'h3'
import { getAuth } from '../../utils/auth.js'

export function createAuthEventHandler(getAuthInstance = getAuth) {
  if (typeof getAuthInstance !== 'function') {
    throw new TypeError('getAuthInstance must be a function.')
  }

  return defineEventHandler((event) => {
    return getAuthInstance().handler(toWebRequest(event))
  })
}

export default createAuthEventHandler()
