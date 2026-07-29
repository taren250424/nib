export function throttle<T extends (...args: any[]) => any>(fn: T, wait = 500) {
  let lastTime = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestArgs: Parameters<T> | null = null

  const execute = () => {
    if (latestArgs) {
      fn(...latestArgs)
      lastTime = Date.now()
      timer = null
      latestArgs = null
    }
  }

  return function (...args: Parameters<T>) {
    latestArgs = args
    const now = Date.now()
    const remaining = wait - (now - lastTime)

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      execute()
    } else if (!timer) {
      timer = setTimeout(execute, remaining)
    }
  }
}
