// Only explicitly linked Wikidata structured facts (CC0), never artist-wide genres.
const qid = /^Q[1-9]\d*$/
export function linkedItems(recording) {
  return [...new Set((recording.relations ?? []).flatMap(relation => {
    if (relation.type !== 'wikidata') return []
    try {
      const url = new URL(relation.url?.resource)
      const id = url.pathname.match(/^\/(?:wiki\/)?(Q[1-9]\d*)$/)?.[1]
      return ['www.wikidata.org', 'wikidata.org'].includes(url.hostname) && ['https:', 'http:'].includes(url.protocol) && id ? [id] : []
    } catch { return [] }
  }))].slice(0, 2)
}
export function claimIds(entity, property) {
  return [...new Set((entity.claims?.[property] ?? []).filter(c => c.rank !== 'deprecated')
    .map(c => c.mainsnak?.datavalue?.value?.id).filter(id => qid.test(id ?? '')))].slice(0, 12)
}
export async function songContext(recording, fetcher = fetch, scope = 'MusicBrainz-linked recording') {
  const ids = linkedItems(recording)
  if (!ids.length) return []
  const get = async ids => {
    const params = new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'),
      props: 'labels|claims', languages: 'en', format: 'json' })
    const response = await fetcher(`https://www.wikidata.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'Playback/0.1 (https://github.com/davidfromkansas/playback)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw Error('Public context unavailable')
    return (await response.json()).entities ?? {}
  }
  const entities = await get(ids)
  const wanted = [...new Set(ids.flatMap(id => {
    const entity = entities[id]
    return entity ? [...claimIds(entity, 'P136'), ...claimIds(entity, 'P870')] : []
  }))]
  if (!wanted.length) return []
  const labels = await get(wanted)
  const names = (entity, property) => claimIds(entity, property).flatMap(id => {
    const value = labels[id]?.labels?.en?.value
    return typeof value === 'string' && value.length <= 160 ? [{ id, name: value }] : []
  })
  return ids.flatMap(id => {
    const entity = entities[id]
    if (!entity || entity.id !== id || entity.missing !== undefined) return []
    const genres = names(entity, 'P136'), instruments = names(entity, 'P870')
    return genres.length || instruments.length ? [{ source: 'Wikidata', license: 'CC0-1.0',
      sourceUrl: `https://www.wikidata.org/wiki/${id}`, entityId: id,
      scope, genres, instruments }] : []
  })
}
