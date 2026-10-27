import http from 'node:http'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { pipeline } from 'node:stream'
import WebTorrent from 'webtorrent'

const port = Number(process.env.PORT || 3000)
const dataDir = process.env.DATA_DIR || '/data'
const metadataTimeoutMs = Number(process.env.METADATA_TIMEOUT_MS || 90000)
const maxRequestBytes = 4096
const maxTorrentBytes = 2 * 1024 * 1024 * 1024
const maxActiveTorrents = 3
const torrents = new Map()
const indexHtml = await readFile(new URL('./public/index.html', import.meta.url))
const videoMimeTypes = new Map([
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.ogv', 'video/ogg'],
  ['.ogg', 'video/ogg'],
  ['.mov', 'video/quicktime'],
  ['.mkv', 'video/x-matroska'],
  ['.mpg', 'video/mpeg'],
  ['.mpeg', 'video/mpeg'],
  ['.ts', 'video/mp2t'],
  ['.avi', 'video/x-msvideo']
])
const announce = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz'
]

const client = new WebTorrent({
  dht: true,
  tracker: true,
  lsd: false,
  utPex: false,
  utp: false,
  natUpnp: false,
  natPmp: false,
  maxConns: 16,
  downloadLimit: 2 * 1024 * 1024,
  uploadLimit: 64 * 1024
})

client.on('error', error => {
  console.error('WebTorrent client error:', error.message)
})

function sendJson (response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  })
  response.end(body)
}

function torrentStatus (entry) {
  const torrent = entry.torrent
  return {
    infoHash: entry.infoHash,
    state: entry.state,
    name: torrent.name || null,
    progress: torrent.progress || 0,
    downloaded: torrent.downloaded || 0,
    uploaded: torrent.uploaded || 0,
    totalBytes: torrent.length || torrent.files.reduce((total, file) => total + file.length, 0),
    peers: torrent.numPeers || 0,
    downloadSpeed: torrent.downloadSpeed || 0,
    uploadSpeed: torrent.uploadSpeed || 0,
    error: entry.error || null,
    files: torrent.files.map((file, index) => ({
      index,
      name: file.name,
      length: file.length,
      progress: Math.max(0, Math.min(1, file.progress || 0)),
      streamPath: `/torrents/${entry.infoHash}/files/${index}`
    }))
  }
}

async function removeTorrent (entry) {
  if (entry.removed) return
  if (entry.removePromise) return entry.removePromise

  clearTimeout(entry.metadataTimer)
  entry.removePromise = client.remove(entry.infoHash, { destroyStore: false })
    .then(() => {
      entry.removed = true
    })
    .catch(error => {
      if (entry.state === 'error' && error.message === `No torrent with id ${entry.infoHash}`) {
        entry.removed = true
        return
      }
      throw error
    })
    .finally(() => {
      entry.removePromise = null
    })
  return entry.removePromise
}

async function readJson (request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxRequestBytes) {
      request.destroy()
      throw new Error('Request body exceeds 4096 bytes')
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

function parseRange (header, length) {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || length === 0) return false

  let start
  let end
  if (match[1] === '') {
    const suffixLength = Number(match[2])
    if (!suffixLength) return false
    start = Math.max(0, length - suffixLength)
    end = length - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? length - 1 : Number(match[2])
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || start >= length || end < start) return false
  return { start, end: Math.min(end, length - 1) }
}

function serveFile (request, response, entry, index) {
  const torrent = entry.torrent
  const file = torrent.files[index]
  if (!file || entry.state === 'error') {
    sendJson(response, 404, { error: 'File not found or torrent unavailable' })
    return
  }

  const range = parseRange(request.headers.range, file.length)
  if (range === false) {
    response.writeHead(416, { 'content-range': `bytes */${file.length}` })
    response.end()
    return
  }

  const start = range ? range.start : 0
  const end = range ? range.end : file.length - 1
  const extension = path.extname(file.name).toLowerCase()
  const headers = {
    'accept-ranges': 'bytes',
    'content-type': videoMimeTypes.get(extension) || 'application/octet-stream',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(file.name))}`,
    'content-length': Math.max(0, end - start + 1),
    'cache-control': 'no-store'
  }

  if (range) headers['content-range'] = `bytes ${start}-${end}/${file.length}`
  response.writeHead(range ? 206 : 200, headers)
  if (request.method === 'HEAD' || file.length === 0) {
    response.end()
    return
  }

  pipeline(file.createReadStream({ start, end }), response, error => {
    if (error && !response.destroyed) {
      console.error('File stream error:', error.message)
      response.destroy(error)
    }
  })
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1')

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': indexHtml.length,
      'cache-control': 'no-cache'
    })
    response.end(indexHtml)
    return
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok', engine: 'webtorrent', activeTorrents: torrents.size })
    return
  }

  if (request.method === 'GET' && url.pathname === '/torrents') {
    sendJson(response, 200, [...torrents.values()].map(torrentStatus))
    return
  }

  if (request.method === 'POST' && url.pathname === '/torrents') {
    let body
    try {
      body = await readJson(request)
    } catch (error) {
      if (!response.destroyed) sendJson(response, 400, { error: error.message })
      return
    }

    if (typeof body?.magnet !== 'string') {
      sendJson(response, 400, { error: 'Provide a magnet URI in the magnet field' })
      return
    }

    let infoHash
    try {
      if (/^[a-f\d]{40}$/i.test(body.magnet.trim())) {
        infoHash = body.magnet.trim().toLowerCase()
      } else {
        const magnet = new URL(body.magnet)
        const xt = magnet.searchParams.get('xt') || ''
        const match = /^urn:btih:([a-f\d]{40})$/i.exec(xt)
        if (magnet.protocol !== 'magnet:' || !match) throw new Error()
        infoHash = match[1].toLowerCase()
      }
    } catch {
      sendJson(response, 400, { error: 'Enter a magnet URI or a 40-character hexadecimal BitTorrent info hash' })
      return
    }

    if (torrents.has(infoHash)) {
      sendJson(response, 409, { error: 'This torrent is already in the active list', infoHash })
      return
    }

    if (torrents.size >= maxActiveTorrents) {
      sendJson(response, 429, { error: `The demo supports up to ${maxActiveTorrents} active torrents` })
      return
    }

    try {
      const torrent = client.add(`magnet:?xt=urn:btih:${infoHash}`, {
        path: dataDir,
        announce,
        maxConns: 16,
        destroyStoreOnDestroy: false
      })
      const entry = { torrent, state: 'resolving', error: null, removed: false, removePromise: null }
      entry.infoHash = infoHash
      torrents.set(infoHash, entry)
      const metadataTimer = setTimeout(() => {
        if (entry.state !== 'resolving') return
        entry.state = 'error'
        entry.error = 'Metadata discovery timed out; check DHT connectivity and peer availability'
        removeTorrent(entry).catch(error => {
          console.error('Could not remove timed-out torrent:', error.message)
        })
      }, metadataTimeoutMs)
      entry.metadataTimer = metadataTimer
      metadataTimer.unref()

      torrent.once('metadata', () => {
        const totalBytes = torrent.files.reduce((total, file) => total + file.length, 0)
        if (totalBytes <= maxTorrentBytes) return

        clearTimeout(entry.metadataTimer)
        entry.state = 'error'
        entry.error = 'Torrent exceeds the 2 GiB demo limit'
        removeTorrent(entry).catch(error => {
          console.error('Could not remove oversized torrent:', error.message)
        })
      })
      torrent.once('ready', () => {
        if (entry.state === 'error') return
        clearTimeout(entry.metadataTimer)
        entry.state = torrent.done ? 'complete' : 'downloading'
        console.log(`Torrent metadata ready: ${infoHash} (${torrent.name})`)
      })
      torrent.on('done', () => {
        if (entry.state === 'error') return
        entry.state = 'complete'
        console.log(`Torrent download complete: ${infoHash}`)
      })
      torrent.on('error', error => {
        clearTimeout(entry.metadataTimer)
        entry.state = 'error'
        entry.error = error.message
        console.error(`Torrent error ${infoHash}:`, error.message)
      })

      sendJson(response, 202, {
        infoHash,
        state: entry.state,
        statusPath: `/torrents/${infoHash}`
      })
    } catch (error) {
      sendJson(response, 400, { error: error.message })
    }
    return
  }

  const fileMatch = /^\/torrents\/([a-f\d]{40})\/files\/(\d+)$/.exec(url.pathname)
  if ((request.method === 'GET' || request.method === 'HEAD') && fileMatch) {
    const entry = torrents.get(fileMatch[1])
    if (!entry || entry.state === 'resolving') {
      sendJson(response, entry ? 425 : 404, { error: entry ? 'Torrent metadata is not ready' : 'Torrent not found' })
      return
    }
    serveFile(request, response, entry, Number(fileMatch[2]))
    return
  }

  const deleteMatch = /^\/torrents\/([a-f\d]{40})$/.exec(url.pathname)
  if (request.method === 'DELETE' && deleteMatch) {
    const infoHash = deleteMatch[1]
    const entry = torrents.get(infoHash)
    if (!entry) {
      sendJson(response, 404, { error: 'Torrent not found' })
      return
    }

    try {
      await removeTorrent(entry)
      torrents.delete(infoHash)
      sendJson(response, 200, { removed: true, infoHash, dataPreserved: true })
    } catch (error) {
      sendJson(response, 500, { error: 'Could not stop torrent: ' + error.message })
    }
    return
  }

  const statusMatch = /^\/torrents\/([a-f\d]{40})$/.exec(url.pathname)
  if (request.method === 'GET' && statusMatch) {
    const entry = torrents.get(statusMatch[1])
    sendJson(response, entry ? 200 : 404, entry ? torrentStatus(entry) : { error: 'Torrent not found' })
    return
  }

  sendJson(response, 404, { error: 'Not found' })
})

server.requestTimeout = 30000
server.headersTimeout = 10000
server.keepAliveTimeout = 5000

server.listen(port, '0.0.0.0', () => {
  console.log(`WebTorrent manual demo listening on container port ${port}`)
})

let shuttingDown = false
function shutdown () {
  if (shuttingDown) return
  shuttingDown = true
  console.log('Stopping WebTorrent manual demo')

  const forceExit = setTimeout(() => process.exit(1), 10000)
  forceExit.unref()

  server.close()
  client.destroy(error => {
    clearTimeout(forceExit)
    if (error) {
      console.error('WebTorrent shutdown error:', error.message)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
