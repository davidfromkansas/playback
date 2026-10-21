import { useEffect, useState } from 'react'

export type TimeOfDay = 'day' | 'sunset' | 'night'

export function timeOfDay(date = new Date(), search = window.location.search): TimeOfDay {
  const override = new URLSearchParams(search).get('sky')
  if (override === 'day' || override === 'sunset' || override === 'night') return override
  const hour = date.getHours()
  if (hour >= 7 && hour < 17) return 'day'
  if (hour >= 5 && hour < 20) return 'sunset'
  return 'night'
}

export function useTimeOfDay(): TimeOfDay {
  const [sky, setSky] = useState(() => timeOfDay())
  useEffect(() => {
    const update = () => setSky(timeOfDay())
    const interval = window.setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('popstate', update)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return sky
}
