// One share helper for profiles and spots, so both behave identically:
// the OS sheet where it exists, the clipboard where it doesn't, and a visible
// answer either way — a tap that appears to do nothing reads as broken.
export function copyFallback(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return ok
}

export async function shareOrCopy({ title, text, url }, onToast) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return
    } catch (e) {
      if (e?.name === 'AbortError') return // they changed their mind
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    onToast?.('Link copied')
  } catch {
    onToast?.(copyFallback(url) ? 'Link copied' : url)
  }
}
