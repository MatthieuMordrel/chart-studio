import {cleanup} from '@testing-library/react'
import {afterEach} from 'vitest'

/**
 * Ensure every test starts from a clean DOM.
 */
afterEach(() => {
  cleanup()
})
