import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAuthErrorCallbackURL,
  getAuthErrorMessage,
  sanitizeAuthReturnTo,
} from '../app/utils/auth-navigation.js'

test('auth return paths preserve same-origin calculator state', () => {
  assert.equal(
    sanitizeAuthReturnTo('/plan?gp=shared-plan#priority'),
    '/plan?gp=shared-plan#priority',
  )
  assert.equal(sanitizeAuthReturnTo(['/upgrade?item=weapon', '/']), '/upgrade?item=weapon')
})

test('auth return paths reject redirects and auth endpoint loops', () => {
  const rejected = [
    'https://example.com/steal',
    '//example.com/steal',
    '/%2Fexample.com/steal',
    '/%2f%2fexample.com/steal',
    '/\\example.com/steal',
    '/%5C%5Cexample.com/steal',
    '/api/auth/get-session',
    '/api%2Fauth/sign-out',
    '/auth/error',
    '/auth/error/retry',
    '/auth%2Ferror',
  ]

  rejected.forEach((value) => {
    assert.equal(sanitizeAuthReturnTo(value), '/', value)
  })

  assert.equal(sanitizeAuthReturnTo('invalid', '/plan'), '/plan')
  assert.equal(sanitizeAuthReturnTo('invalid', 'https://example.com'), '/')
})

test('auth errors use a safe callback and allowlisted copy', () => {
  assert.equal(
    getAuthErrorCallbackURL('/plan?gp=one two'),
    '/auth/error?returnTo=%2Fplan%3Fgp%3Done%2520two',
  )
  assert.deepEqual(getAuthErrorMessage('access_denied'), {
    title: 'Discord sign-in was cancelled',
    description: 'No account changes were made. You can try again whenever you are ready.',
  })
  assert.deepEqual(getAuthErrorMessage('<script>alert(1)</script>'), {
    title: 'We could not sign you in',
    description: 'Account access is temporarily unavailable. Your calculator data has not been changed.',
  })
})
