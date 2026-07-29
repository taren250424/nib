export function adjustMenuPosition(e: MouseEvent, menu: HTMLElement) {
  const menuWidth = menu.offsetWidth
  const menuHeight = menu.offsetHeight
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  let left = e.clientX
  let top = e.clientY

  if (left + menuWidth > screenWidth) {
    left = Math.max(0, screenWidth - menuWidth - 5)
  }

  if (top + menuHeight > screenHeight) {
    top = Math.max(0, screenHeight - menuHeight - 5)
  }

  menu.style.left = `${left}px`
  menu.style.top = `${top}px`
}
