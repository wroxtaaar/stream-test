const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const DEFAULTS = {
    timeoutMs: 5000,
    maxRedirects: 5,
    missingTtlMs: 24 * 60 * 60 * 1000,
    quotaTtlMs: 45 * 60 * 1000,
    accessDeniedTtlMs: 15 * 60 * 1000,
    availableTtlMs: 7 * 60 * 1000,
    concurrency: 4
};

function configuredDuration(name, fallback) {
    const rawValue = process.env[name];
    if (rawValue === undefined) return fallback;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 1000) {
        throw new RangeError(`${name} must be a finite number of at least 1000 milliseconds.`);
    }
    return value;
}

function configuredConcurrency(name, fallback) {
    const rawValue = process.env[name];
    if (rawValue === undefined) return fallback;
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 1 || value > 16) {
        throw new RangeError(`${name} must be an integer between 1 and 16.`);
    }
    return value;
}

function getPixeldrainFileId(url) {
    const match = url.pathname.match(/\/(?:api\/)?(?:file|u)\/([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
}

function getGoogleDriveFileId(url) {
    const pathMatch = url.pathname.match(/\/(?:file\/d|d)\/([A-Za-z0-9_-]+)/i);
    return pathMatch ? pathMatch[1] : url.searchParams.get('id');
}

function identifyLink(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return { status: 'unknown', reason: 'malformed_url', host: 'unknown', key: null };
    }

    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        return { status: 'unknown', reason: 'malformed_url', host: 'unknown', key: null };
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        return { status: 'unknown', reason: 'malformed_url', host: 'unknown', key: null };
    }

    url.hash = '';
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'pixeldrain.com' || hostname === 'pixeldrain.dev' || hostname === 'pixeldrain.net') {
        const fileId = getPixeldrainFileId(url);
        if (!fileId) {
            return { status: 'unknown', reason: 'malformed_url', host: 'pixeldrain.com', key: null };
        }
        return {
            kind: 'pixeldrain',
            host: 'pixeldrain.com',
            fileId,
            key: `pixeldrain.com:${fileId}`
        };
    }

    if (hostname === 'drive.google.com' || hostname === 'drive.usercontent.google.com') {
        const fileId = getGoogleDriveFileId(url);
        if (!fileId) {
            return { status: 'unknown', reason: 'malformed_url', host: hostname, key: null };
        }
        return {
            kind: 'google_drive',
            host: 'drive.google.com',
            fileId,
            key: `drive.google.com:${fileId}`,
            url: url.href
        };
    }

    return {
        status: 'unknown',
        reason: 'unsupported_host',
        host: hostname,
        key: null
    };
}

function responseText(data) {
    if (Buffer.isBuffer(data)) return data.toString('utf8').slice(0, 64 * 1024);
    if (typeof data === 'string') return data.slice(0, 64 * 1024);
    try {
        return JSON.stringify(data || {}).slice(0, 64 * 1024);
    } catch {
        return '';
    }
}

function parsedResponse(data) {
    if (data && typeof data === 'object' && !Buffer.isBuffer(data)) return data;
    const text = responseText(data);
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function classifyPixeldrain(status, data) {
    const body = parsedResponse(data);
    if (status === 404 || body?.value === 'not_found') {
        return { status: 'not_found', reason: 'pixeldrain_not_found' };
    }
    if (status === 429) return { status: 'unknown', reason: 'host_rate_limited' };
    if (status >= 500) return { status: 'unknown', reason: 'host_server_error' };
    if (/temporarily|try again later|unusual traffic|rate limit/i.test(responseText(data))) {
        return { status: 'unknown', reason: 'host_temporarily_restricted' };
    }
    if (status === 401) return { status: 'access_denied', reason: 'access_denied' };
    if (status === 403) {
        const text = responseText(data).toLowerCase();
        if (/permission denied|access denied|not authorized/.test(text)) {
            return { status: 'access_denied', reason: 'access_denied' };
        }
        return { status: 'unknown', reason: 'validation_unknown' };
    }
    if (status >= 200 && status < 300 && body?.success === true && (body?.name || body?.value?.name)) {
        return { status: 'available', reason: 'pixeldrain_file_info_found' };
    }
    return { status: 'unknown', reason: 'validation_unknown' };
}

function classifyGoogleDrive(status, data, headers = {}) {
    const body = parsedResponse(data);
    const text = responseText(data).toLowerCase();
    const reasons = Array.isArray(body?.error?.errors) ? body.error.errors.map(error => error.reason) : [];
    const reasonText = `${body?.error?.status || ''} ${reasons.join(' ')}`.toLowerCase();

    if (/downloadquotaexceeded/.test(reasonText) ||
        /downloadquotaexceeded/.test(text) ||
        /download quota(?: for this file)? has been exceeded/.test(text) ||
        /too many users have viewed or downloaded this file recently/.test(text)) {
        return { status: 'quota_exceeded', reason: 'google_drive_quota_exceeded' };
    }
    if (/temporarily unavailable|temporarily restricted|try again later|unusual traffic|rate limit|too many requests/.test(text)) {
        return { status: 'unknown', reason: 'host_temporarily_restricted' };
    }
    if (/insufficientfilepermissions|permissiondenied/.test(reasonText) ||
        /insufficientfilepermissions|permissiondenied/.test(text) ||
        /you need access|request access|you do not have permission|access denied/.test(text)) {
        return { status: 'access_denied', reason: 'access_denied' };
    }
    if (/\bnot[_ ]?found\b/.test(reasonText) ||
        /the file you have requested does not exist|file not found/.test(text)) {
        return { status: 'not_found', reason: 'google_drive_not_found' };
    }
    if (status === 429) return { status: 'unknown', reason: 'host_rate_limited' };
    if (status >= 500) return { status: 'unknown', reason: 'host_server_error' };
    if (status === 401) return { status: 'access_denied', reason: 'access_denied' };

    const contentType = String(headers['content-type'] || '').toLowerCase();
    const contentDisposition = String(headers['content-disposition'] || '').toLowerCase();
    if ((status === 200 || status === 206) &&
        !contentType.includes('text/html') &&
        (/^(video|audio)\//.test(contentType) ||
            contentType.includes('application/octet-stream') ||
            contentDisposition.includes('attachment'))) {
        return { status: 'available', reason: 'google_drive_file_response' };
    }
    return { status: 'unknown', reason: 'validation_unknown' };
}

function errorReason(error) {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || error?.code === 'ESOCKETTIMEDOUT') {
        return 'validation_timeout';
    }
    if (error?.response?.status === 429) return 'host_rate_limited';
    if (error?.response?.status >= 500) return 'host_server_error';
    return 'validation_unknown';
}

function ttlForResult(result, config) {
    if (result.status === 'not_found') return config.missingTtlMs;
    if (result.status === 'quota_exceeded') return config.quotaTtlMs;
    if (result.status === 'access_denied') return config.accessDeniedTtlMs;
    if (result.status === 'available') return config.availableTtlMs;
    return 0;
}

async function mapWithConcurrency(items, concurrency, callback) {
    const output = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(items.length, Math.max(1, concurrency));

    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            output[index] = await callback(items[index], index);
        }
    }));

    return output;
}

function rankAndFilterCandidates(candidates) {
    const eligible = candidates.filter(candidate =>
        candidate.linkAvailability.status === 'available' ||
        candidate.linkAvailability.status === 'unknown'
    );
    return eligible.sort((left, right) => {
        const leftRank = left.linkAvailability.status === 'available' ? 0 : 1;
        const rightRank = right.linkAvailability.status === 'available' ? 0 : 1;
        return leftRank - rightRank;
    });
}

class LinkAvailabilityService {
    constructor(options = {}) {
        this.request = options.request || this.defaultRequest;
        this.cacheDir = options.cacheDir === undefined
            ? path.join(__dirname, '..', '.streams_cache', 'link-availability')
            : options.cacheDir;
        this.now = options.now || Date.now;
        this.logger = options.logger || console;
        this.inFlight = new Map();
        this.activeChecks = 0;
        this.checkWaiters = [];
        this.config = {
            timeoutMs: options.timeoutMs || configuredDuration('LINK_AVAILABILITY_TIMEOUT_MS', DEFAULTS.timeoutMs),
            maxRedirects: DEFAULTS.maxRedirects,
            missingTtlMs: options.missingTtlMs || configuredDuration('LINK_AVAILABILITY_NOT_FOUND_TTL_MS', DEFAULTS.missingTtlMs),
            quotaTtlMs: options.quotaTtlMs || configuredDuration('LINK_AVAILABILITY_QUOTA_TTL_MS', DEFAULTS.quotaTtlMs),
            accessDeniedTtlMs: options.accessDeniedTtlMs || configuredDuration('LINK_AVAILABILITY_ACCESS_DENIED_TTL_MS', DEFAULTS.accessDeniedTtlMs),
            availableTtlMs: options.availableTtlMs || configuredDuration('LINK_AVAILABILITY_AVAILABLE_TTL_MS', DEFAULTS.availableTtlMs),
            concurrency: options.concurrency || configuredConcurrency('LINK_AVAILABILITY_CONCURRENCY', DEFAULTS.concurrency)
        };
    }

    async defaultRequest(options) {
        const axios = require('axios');
        return axios.request(options);
    }

    getCachePath(key) {
        const digest = crypto.createHash('sha256').update(key).digest('hex');
        return path.join(this.cacheDir, `${digest}.json`);
    }

    async readCache(key) {
        if (!this.cacheDir) return null;
        try {
            const cached = JSON.parse(await fs.readFile(this.getCachePath(key), 'utf8'));
            const ttlMs = ttlForResult(cached, this.config);
            if (!ttlMs || !Number.isFinite(cached.checkedAt) || this.now() - cached.checkedAt >= ttlMs) {
                return null;
            }
            return { status: cached.status, reason: cached.reason };
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.warn(`[LinkAvailability] Cache read failed: ${error.message}`);
            }
            return null;
        }
    }

    async writeCache(key, result) {
        if (!this.cacheDir || !ttlForResult(result, this.config)) return;
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            await fs.writeFile(this.getCachePath(key), JSON.stringify({
                status: result.status,
                reason: result.reason,
                checkedAt: this.now()
            }), 'utf8');
        } catch (error) {
            this.logger.warn(`[LinkAvailability] Cache write failed: ${error.message}`);
        }
    }

    async withConcurrencyLimit(callback) {
        if (this.activeChecks >= this.config.concurrency) {
            await new Promise(resolve => this.checkWaiters.push(resolve));
        } else {
            this.activeChecks++;
        }

        try {
            return await callback();
        } finally {
            const nextWaiter = this.checkWaiters.shift();
            if (nextWaiter) nextWaiter();
            else this.activeChecks--;
        }
    }

    async validate(url, options = {}) {
        const identity = identifyLink(url);
        const provider = options.provider || 'unknown';
        if (!identity.kind) {
            return {
                status: identity.status || 'unknown',
                reason: identity.reason,
                host: identity.host
            };
        }

        if (this.inFlight.has(identity.key)) return this.inFlight.get(identity.key);

        const work = (async () => {
            const cached = await this.readCache(identity.key);
            if (cached) return { ...cached, host: identity.host, cached: true };

            let result;
            try {
                result = await this.withConcurrencyLimit(() => identity.kind === 'pixeldrain'
                    ? this.validatePixeldrain(identity)
                    : this.validateGoogleDrive(identity));
            } catch (error) {
                result = { status: 'unknown', reason: errorReason(error) };
            }

            const fullResult = { ...result, host: identity.host, cached: false };
            await this.writeCache(identity.key, fullResult);
            if (fullResult.status !== 'available') {
                this.logger.warn(`[LinkAvailability] provider=${provider} host=${identity.host} reason=${fullResult.reason}`);
            }
            return fullResult;
        })();

        this.inFlight.set(identity.key, work);
        try {
            return await work;
        } finally {
            this.inFlight.delete(identity.key);
        }
    }

    async validatePixeldrain(identity) {
        const response = await this.request({
            method: 'GET',
            url: `https://pixeldrain.com/api/file/${encodeURIComponent(identity.fileId)}/info`,
            timeout: this.config.timeoutMs,
            maxRedirects: this.config.maxRedirects,
            maxContentLength: 64 * 1024,
            validateStatus: () => true
        });
        return classifyPixeldrain(response.status, response.data);
    }

    async validateGoogleDrive(identity) {
        const response = await this.request({
            method: 'GET',
            url: identity.url,
            headers: { Range: 'bytes=0-0' },
            timeout: this.config.timeoutMs,
            maxRedirects: this.config.maxRedirects,
            maxContentLength: 64 * 1024,
            responseType: 'arraybuffer',
            validateStatus: () => true
        });
        return classifyGoogleDrive(response.status, response.data, response.headers);
    }

    async validateCandidates(links, options = {}) {
        const seen = new Set();
        const unique = [];
        for (const link of links) {
            if (!link || typeof link.url !== 'string') continue;
            const identity = identifyLink(link.url);
            const dedupeKey = identity.key || (() => {
                try {
                    const normalized = new URL(link.url);
                    normalized.hash = '';
                    return normalized.href;
                } catch {
                    return `malformed:${link.url}`;
                }
            })();
            if (!seen.has(dedupeKey)) {
                seen.add(dedupeKey);
                unique.push(link);
            }
        }

        const checked = await mapWithConcurrency(
            unique,
            options.concurrency || this.config.concurrency,
            async link => {
                const linkAvailability = await this.validate(link.url, {
                    provider: options.provider || link.provider
                });
                return {
                    ...link,
                    linkAvailability: {
                        ...linkAvailability,
                        playbackTested: false
                    }
                };
            }
        );
        const ranked = rankAndFilterCandidates(checked);
        const removed = checked.filter(candidate => !ranked.includes(candidate));
        if (removed.length > 0) {
            this.logger.info(`[LinkAvailability] provider=${options.provider || 'unknown'} fallback_selected=${ranked.length > 0} suppressed=${removed.map(item => item.linkAvailability.reason).join(',')}`);
        }
        return ranked;
    }
}

const defaultLinkAvailability = new LinkAvailabilityService();

module.exports = {
    LinkAvailabilityService,
    classifyGoogleDrive,
    classifyPixeldrain,
    identifyLink,
    mapWithConcurrency,
    rankAndFilterCandidates,
    defaultLinkAvailability
};
