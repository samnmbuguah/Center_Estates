import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  jest.useFakeTimers()

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300))
    expect(result.current).toBe('test')
  })

  it('should update after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'initial' },
    })

    expect(result.current).toBe('initial')

    act(() => {
      rerender({ value: 'updated' })
    })

    // Should still be initial before delay
    expect(result.current).toBe('initial')

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(300)
    })

    // Should be updated after delay
    expect(result.current).toBe('updated')
  })

  it('should reset the timer on value change', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'initial' },
    })

    act(() => {
      rerender({ value: 'first' })
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(result.current).toBe('initial')

    act(() => {
      rerender({ value: 'second' })
    })

    act(() => {
      jest.advanceTimersByTime(200)
    })

    expect(result.current).toBe('initial')

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(result.current).toBe('second')
  })

  afterEach(() => {
    jest.clearAllTimers()
  })
})
