const axios = require('axios');

const ADDONS = [
    { id: 'magnetio', name: 'Magnetio', enabledKey: 'ENABLE_MAGNETIO_ADDON', urlKey: 'MAGNETIO_MANIFEST_URL' },
    { id: 'aiostreams', name: 'AIOStreams', enabledKey: 'ENABLE_AIOSTREAMS_ADDON', urlKey: 'AIOSTREAMS_MANIFEST_URL' }
];
const MANIFEST_TIMEOUT_MS = 5000;
const STREAM_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENCY = 2;

function isHttpUrl(value) {
    if (typeof value !== 'string' || value.length > 8192) return false;
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') &&
            !url.username && !url.password && Boolean(url.hostname);
    } catch {
        return false;
    }
}

function getConfiguredAddons(env = process.env) {
    return ADDONS.map(addon => {
        const requested = env[addon.enabledKey] === 'true';
        const manifestUrl = typeof env[addon.urlKey] === 'string' ? env[addon.urlKey].trim() : '';
        const validUrl = isManifestUrl(manifestUrl);
        return {
            id: addon.id,
            name: addon.name,
            enabled: requested && validUrl,
            status: requested ? (validUrl ? 'enabled' : 'invalid_configuration') : 'disabled',
            configured: Boolean(manifestUrl),
            validUrl,
            manifestUrl: requested && validUrl ? manifestUrl : null
        };
    });
}

function isManifestUrl(value) {
    if (!isHttpUrl(value)) return false;
    try {
        return /\/manifest\.json$/i.test(new URL(value).pathname);
    } catch {
        return false;
    }
}

function isConfiguredManifestEndpoint(value, manifestUrl) {
    try {
        const candidate = new URL(value);
        const manifest = new URL(manifestUrl);
        return candidate.origin === manifest.origin && candidate.pathname === manifest.pathname;
    } catch {
        return false;
    }
}

function buildResourceUrl(manifestUrl, resource, type, id) {
    const url = new URL(manifestUrl);
    const normalizedType = type === 'tv' ? 'series' : type;
    url.pathname = url.pathname.replace(/manifest\.json$/i,
        `${resource}/${normalizedType}/${encodeURIComponent(id)}.json`);
    return url.toString();
}

function validateManifest(manifest, type, id) {
    if (!manifest || typeof manifest !== 'object' ||
        typeof manifest.id !== 'string' ||
        !Array.isArray(manifest.resources) ||
        !Array.isArray(manifest.types)) {
        return 'Invalid Stremio manifest';
    }
    const supportsStream = manifest.resources.some(resource =>
        resource === 'stream' || (resource && typeof resource === 'object' && resource.name === 'stream')
    );
    const normalizedType = type === 'tv' ? 'series' : type;
    if (!supportsStream || !manifest.types.includes(normalizedType)) {
        return 'Addon does not support this stream type';
    }
    if (Array.isArray(manifest.idPrefixes) &&
        manifest.idPrefixes.length > 0 &&
        !manifest.idPrefixes.some(prefix => typeof prefix === 'string' && id.startsWith(prefix))) {
        return 'Addon does not support this ID format';
    }
    return null;
}

function getSource(stream, addonName) {
    return firstString(stream.source, stream.provider, stream.name, addonName);
}

function sanitizeMetadata(value) {
    if (typeof value !== 'string') return '';
    return value.trim()
        .replace(/https?:\/\/[^\s"'<>]+/gi, '[link omitted]')
        .replace(/\b(api[_-]?key|token|cookie|secret|password|auth|signature|sig)=([^&\s]+)/gi, '$1=[redacted]')
        .slice(0, 300);
}

function firstString(...values) {
    const value = values.find(item => typeof item === 'string' && item.trim());
    return value ? sanitizeMetadata(value) : '';
}

function sanitizeMagnet(value) {
    try {
        const query = value.slice(value.indexOf('?') + 1);
        const params = new URLSearchParams(query);
        const safe = new URLSearchParams();
        const xt = params.get('xt');
        const dn = params.get('dn');
        if (xt && /^urn:btih:(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(xt)) safe.set('xt', xt);
        if (dn) safe.set('dn', sanitizeMetadata(dn).slice(0, 200));
        return safe.has('xt') ? `magnet:?${safe.toString()}` : null;
    } catch {
        return null;
    }
}

function validInfoHash(value) {
    return /^[a-f0-9]{40}$/i.test(value) || /^[a-z2-7]{32}$/i.test(value);
}

function normalizeStream(stream, addon) {
    if (!stream || typeof stream !== 'object' || Array.isArray(stream)) {
        return { classification: 'unavailable', source: addon.name, error: 'Malformed stream entry' };
    }

    const text = value => firstString(value);
    const normalized = {
        classification: 'unavailable',
        addon: addon.name,
        source: getSource(stream, addon.name),
        name: text(stream.name),
        title: text(stream.title, stream.description),
        description: text(stream.description),
        quality: text(stream.quality),
        filename: text(stream.filename || stream.fileName),
        language: text(stream.language),
        languages: Array.isArray(stream.languages)
            ? stream.languages.filter(value => typeof value === 'string').slice(0, 10).map(value => sanitizeMetadata(value).slice(0, 80))
            : [],
        audio: text(stream.audio) || (Array.isArray(stream.audioTracks)
            ? stream.audioTracks.filter(value => typeof value === 'string').slice(0, 10).map(sanitizeMetadata).join(', ').slice(0, 300)
            : text(stream.audioTracks)),
        codec: text(stream.codec),
        releaseInfo: text(stream.releaseInfo),
        releaseGroup: text(stream.releaseGroup),
        size: stream.size ?? null,
        seeders: Number.isFinite(stream.seeders) ? stream.seeders : null,
        infoHash: text(stream.infoHash),
        fileIdx: Number.isInteger(stream.fileIdx) && stream.fileIdx >= 0 ? stream.fileIdx : null
    };

    const safeMagnet = typeof stream.url === 'string' && /^magnet:\?/i.test(stream.url)
        ? sanitizeMagnet(stream.url)
        : null;
    const magnetHash = safeMagnet
        ? new URLSearchParams(safeMagnet.slice(safeMagnet.indexOf('?') + 1)).get('xt')?.replace(/^urn:btih:/i, '')
        : '';
    const infoHash = validInfoHash(normalized.infoHash)
        ? normalized.infoHash
        : validInfoHash(magnetHash || '') ? magnetHash : '';

    if (isHttpUrl(stream.url)) {
        normalized.classification = 'playable';
        normalized.url = stream.url;
    } else if (infoHash || safeMagnet) {
        normalized.classification = 'discovered';
        normalized.infoHash = infoHash;
        normalized.magnet = safeMagnet;
    } else {
        normalized.error = 'Unsupported or invalid stream URL';
    }

    return normalized;
}

function deduplicateStreams(streams) {
    const byIdentity = new Map();
    for (const stream of streams) {
        const releaseIdentity = [
            String(stream.title || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
            String(stream.quality || '').toLowerCase(),
            String(stream.filename || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
            String(stream.language || (Array.isArray(stream.languages) ? stream.languages.join(',') : '')).toLowerCase(),
            String(stream.codec || '').toLowerCase(),
            String(stream.audio || '').toLowerCase(),
            String(stream.releaseInfo || '').toLowerCase(),
            String(stream.releaseGroup || '').toLowerCase(),
            String(stream.size || '').toLowerCase()
        ].join('|');
        const identity = stream.classification === 'playable'
            ? `url:${stream.url}|${releaseIdentity}`
            : stream.classification === 'discovered'
                ? `${stream.infoHash ? `hash:${stream.infoHash.toLowerCase()}` : `magnet:${stream.magnet || ''}`}|${releaseIdentity}`
                : `${stream.classification}:${stream.addon}:${stream.title}:${stream.name}`;
        const existing = byIdentity.get(identity);
        if (!existing) {
            const sources = Array.isArray(stream.sources)
                ? stream.sources.filter(source => typeof source === 'string').map(sanitizeMetadata).filter(Boolean)
                : [];
            if (stream.source && !sources.includes(stream.source)) sources.unshift(stream.source);
            byIdentity.set(identity, { ...stream, sources });
            continue;
        }
        if (stream.source && !existing.sources.includes(stream.source)) existing.sources.push(stream.source);
        if (existing.classification !== 'playable' && stream.classification === 'playable') {
            Object.assign(existing, stream);
        }
    }
    return [...byIdentity.values()];
}

function summarizeError(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return 'Upstream timed out';
    if (error.response) return `Upstream returned HTTP ${error.response.status}`;
    return 'Upstream request failed';
}

async function queryOneAddon(addon, type, id, request = axios.get) {
    if (!addon.enabled) {
        return {
            id: addon.id,
            name: addon.name,
            status: addon.statusOverride || addon.status || 'disabled',
            streams: []
        };
    }
    if (!isManifestUrl(addon.manifestUrl)) {
        return { id: addon.id, name: addon.name, status: 'invalid_configuration', error: 'Manifest URL is invalid', streams: [] };
    }

    const requestOptions = {
        timeout: MANIFEST_TIMEOUT_MS,
        maxRedirects: 0,
        maxContentLength: MAX_RESPONSE_BYTES,
        maxBodyLength: MAX_RESPONSE_BYTES,
        validateStatus: status => status >= 200 && status < 300,
        responseType: 'json'
    };

    try {
        const manifestResponse = await request(addon.manifestUrl, requestOptions);
        const manifestError = validateManifest(manifestResponse.data, type, id);
        if (manifestError) {
            return { id: addon.id, name: addon.name, status: 'unsupported', error: manifestError, streams: [] };
        }

        const streamUrl = buildResourceUrl(addon.manifestUrl, 'stream', type, id);
        const streamResponse = await request(streamUrl, { ...requestOptions, timeout: STREAM_TIMEOUT_MS });
        const streamEntries = streamResponse.data && streamResponse.data.streams;
        if (!Array.isArray(streamEntries)) {
            return { id: addon.id, name: addon.name, status: 'invalid_response', error: 'Invalid Stremio stream response', streams: [] };
        }

        const streams = deduplicateStreams(streamEntries.map(entry => {
            const stream = normalizeStream(entry, addon);
            if (stream.classification === 'playable' &&
                isConfiguredManifestEndpoint(stream.url, addon.manifestUrl)) {
                delete stream.url;
                stream.classification = 'unavailable';
                stream.error = 'Configured manifest endpoint is not a media stream';
            }
            return stream;
        }));
        const playableCount = streams.filter(stream => stream.classification === 'playable').length;
        const discoveredCount = streams.filter(stream => stream.classification === 'discovered').length;
        const unavailableCount = streams.filter(stream => stream.classification === 'unavailable').length;
        return {
            id: addon.id,
            name: addon.name,
            status: playableCount > 0
                ? 'success'
                : discoveredCount > 0
                    ? 'discovered_only'
                    : unavailableCount > 0
                        ? 'invalid_results'
                        : 'empty',
            streams
        };
    } catch (error) {
        return {
            id: addon.id,
            name: addon.name,
            status: error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' ? 'timeout' : 'error',
            error: summarizeError(error),
            streams: []
        };
    }
}

async function queryConfiguredAddons({ type, id }, options = {}) {
    const addons = getConfiguredAddons(options.env || process.env).map(addon => {
        if (Array.isArray(options.selectedProviders) &&
            !options.selectedProviders.includes(addon.id)) {
            return { ...addon, enabled: false, statusOverride: 'not_selected' };
        }
        return addon;
    });
    const request = options.request || axios.get;
    const output = new Array(addons.length);
    let nextIndex = 0;
    const workerCount = Math.min(MAX_CONCURRENCY, addons.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < addons.length) {
            const index = nextIndex++;
            output[index] = await queryOneAddon(addons[index], type, id, request);
        }
    }));

    return output;
}

function toNuvioStreams(addonResults) {
    return addonResults.flatMap(result => result.streams
        .filter(stream => stream.classification === 'playable' && isHttpUrl(stream.url))
        .map(stream => ({
            ...stream,
            provider: result.name,
            source: stream.source || result.name,
            quality: stream.quality || 'UNK'
        })));
}

module.exports = {
    ADDONS,
    buildResourceUrl,
    deduplicateStreams,
    getConfiguredAddons,
    isHttpUrl,
    isConfiguredManifestEndpoint,
    isManifestUrl,
    normalizeStream,
    queryConfiguredAddons,
    queryOneAddon,
    toNuvioStreams,
    validateManifest
};
