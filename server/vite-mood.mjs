import { createMoodService } from './song-mood.mjs'

export function publicSongMoodPlugin(apiKey, enrichment = false) {
  const classify = createMoodService({ apiKey, enrichment })
  return {
    name: 'public-song-mood',
    configureServer(server) {
      // Local pilot only. A public deployment needs a shared rate limiter and access controls.
      server.middlewares.use('/api/song-mood', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        const origin = req.headers.origin
        if (req.method !== 'POST' || !origin || origin !== `http://${req.headers.host}`) {
          res.statusCode = 403
          res.end(JSON.stringify({ status: 'forbidden', profile: null }))
          return
        }
        let body = ''
        req.on('data', chunk => {
          body += chunk
          if (body.length > 2048) {
            res.statusCode = 413
            res.end(JSON.stringify({ status: 'invalid-query', profile: null }))
            req.destroy()
          }
        })
        req.on('end', () => {
          if (res.writableEnded) return
          let query
          try { query = JSON.parse(body) } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ status: 'invalid-query', profile: null }))
            return
          }
          void classify(query).then(result => res.end(JSON.stringify(result))).catch(() => {
            res.statusCode = 503
            res.end(JSON.stringify({ status: 'unavailable', profile: null }))
          })
        })
      })
    },
  }
}
