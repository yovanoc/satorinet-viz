import * as React from "react"

const MOBILE_QUERY = "(max-width: 767px)"

const subscribe = (onStoreChange: () => void) => {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches
const getServerSnapshot = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
