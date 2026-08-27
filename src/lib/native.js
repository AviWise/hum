// What the app has to do differently inside the iOS shell.
//
// env(safe-area-inset-top) comes back 0 in Capacitor's WKWebView, so the
// wordmark landed on the system clock. Rather than fight the inset, the status
// bar stops being ours: the web view starts below it and iOS paints that strip
// in the app's own bone. Nothing here runs on the web, where the browser
// already handles all of this.
export async function setUpNative() {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor?.isNativePlatform?.()) return
  document.documentElement.classList.add('is-native')
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setStyle({ style: Style.Light })   // dark glyphs on our light bar
    await StatusBar.setBackgroundColor({ color: '#F7F3EC' })
  } catch { /* an older shell without the plugin still runs the app */ }
}
