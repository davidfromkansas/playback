export const MOODS: Record<string, string>
export function createMoodService(options?: { apiKey?: string }):
  (query: unknown) => Promise<unknown>
