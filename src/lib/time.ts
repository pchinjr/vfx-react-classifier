// Keep timestamp formatting centralized so CLI output stays consistent.
export function nowIso() {
  return new Date().toISOString()
}

export function formatTimestamp(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${
      String(remainingSeconds).padStart(2, '0')
    }`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}
