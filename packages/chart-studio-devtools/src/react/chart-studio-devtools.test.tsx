import {fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'
import {ChartStudioDevtools} from './chart-studio-devtools.js'

const inertProps = {
  getSnapshot: () => null,
  subscribe: () => () => {},
} as const

afterEach(() => {
  document.body.style.overflow = ''
  document.body.style.overscrollBehavior = ''
  document.body.style.paddingRight = ''
  document.documentElement.style.overflow = ''
  document.documentElement.style.overscrollBehavior = ''
})

describe('ChartStudioDevtools scroll lock', () => {
  it('locks page scrolling while the shell is open and restores inline styles on close', () => {
    document.body.style.overflow = 'clip'
    document.body.style.overscrollBehavior = 'contain'
    document.body.style.paddingRight = '12px'
    document.documentElement.style.overflow = 'clip'
    document.documentElement.style.overscrollBehavior = 'contain'

    const {unmount} = render(<ChartStudioDevtools {...inertProps} defaultOpen />)

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.overscrollBehavior).toBe('none')
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overscrollBehavior).toBe('none')

    fireEvent.click(screen.getByRole('button', {name: 'Close'}))

    expect(document.body.style.overflow).toBe('clip')
    expect(document.body.style.overscrollBehavior).toBe('contain')
    expect(document.body.style.paddingRight).toBe('12px')
    expect(document.documentElement.style.overflow).toBe('clip')
    expect(document.documentElement.style.overscrollBehavior).toBe('contain')

    unmount()
  })

  it('keeps the host page locked until the last open shell unmounts', () => {
    const first = render(<ChartStudioDevtools {...inertProps} defaultOpen />)
    const second = render(<ChartStudioDevtools {...inertProps} defaultOpen />)

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    first.unmount()

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    second.unmount()

    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
  })
})
