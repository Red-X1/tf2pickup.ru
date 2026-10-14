const STORAGE_KEY = 'format-sidebar-collapsed'

function apply(collapsed: boolean) {
  document.documentElement.dataset['formatSidebarCollapsed'] = collapsed ? 'true' : 'false'
}

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function write(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false')
  } catch {
    // ignore (private browsing, quota exceeded)
  }
}

// restore before first paint to avoid flash
apply(read())

document.addEventListener('click', e => {
  const toggle = (e.target as HTMLElement).closest('#format-sidebar-toggle')
  if (!toggle) return
  const next = document.documentElement.dataset['formatSidebarCollapsed'] !== 'true'
  apply(next)
  write(next)
})
