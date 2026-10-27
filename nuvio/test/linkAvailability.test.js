const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    LinkAvailabilityService,
    classifyGoogleDrive,
    classifyPixeldrain,
    identifyLink
} = require('../utils/linkAvailability');

const tests = [];
function test(name, callback) {
    tests.push({ name, callback });
}

function response(status, data = {}, headers = {}) {
    return { status, data, headers };
}

test('Pixeldrain successful file info is available', () => {
    assert.strictEqual(
        classifyPixeldrain(200, { success: true, value: { name: 'movie.mkv' } }).status,
        'available'
    );
});

test('Pixeldrain HTTP 404 is conclusively missing', () => {
    assert.strictEqual(classifyPixeldrain(404, {}).status, 'not_found');
});

test('Pixeldrain generic 403 remains unknown', () => {
    assert.strictEqual(classifyPixeldrain(403, { message: 'Forbidden' }).status, 'unknown');
});

test('Pixeldrain not_found response body is conclusively missing', () => {
    assert.strictEqual(classifyPixeldrain(200, { success: false, value: 'not_found' }).status, 'not_found');
});

test('Google Drive quota reason is distinguished from generic 403', () => {
    const quota = classifyGoogleDrive(403, {
        error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'downloadQuotaExceeded' }] }
    });
    assert.strictEqual(quota.status, 'quota_exceeded');
});

test('Google Drive generic 403 remains unknown', () => {
    assert.strictEqual(classifyGoogleDrive(403, { error: { message: 'Forbidden' } }).status, 'unknown');
});

test('Google Drive temporary restriction remains unknown', () => {
    const result = classifyGoogleDrive(403, 'This file is temporarily restricted. Please try again later.');
    assert.strictEqual(result.status, 'unknown');
    assert.strictEqual(result.reason, 'host_temporarily_restricted');
});

test('Google Drive explicit permission denial is classified as access denied', () => {
    assert.strictEqual(
        classifyGoogleDrive(403, { error: { errors: [{ reason: 'insufficientFilePermissions' }] } }).status,
        'access_denied'
    );
});

test('Google Drive explicit missing-file response is classified as not found', () => {
    assert.strictEqual(
        classifyGoogleDrive(404, { error: { status: 'NOT_FOUND' } }).status,
        'not_found'
    );
});

test('Google Drive quota text in an HTML response is classified correctly', () => {
    assert.strictEqual(
        classifyGoogleDrive(403, 'The download quota for this file has been exceeded.').status,
        'quota_exceeded'
    );
});

test('timeout remains unknown and is not persistently cached', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-availability-'));
    try {
        const service = new LinkAvailabilityService({
            cacheDir,
            request: async () => {
                const error = new Error('timeout');
                error.code = 'ETIMEDOUT';
                throw error;
            },
            logger: { warn() {}, info() {} }
        });
        const result = await service.validate('https://pixeldrain.com/api/file/timeout-id/info');
        assert.strictEqual(result.status, 'unknown');
        assert.strictEqual(result.reason, 'validation_timeout');
        assert.strictEqual(fs.readdirSync(cacheDir).length, 0);
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
});

test('temporary host error remains unknown and is not persistently cached', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-availability-'));
    try {
        const service = new LinkAvailabilityService({
            cacheDir,
            request: async () => response(503),
            logger: { warn() {}, info() {} }
        });
        assert.strictEqual((await service.validate('https://pixeldrain.com/api/file/server-error/info')).status, 'unknown');
        assert.strictEqual(fs.readdirSync(cacheDir).length, 0);
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
});

test('concurrent checks for the same stable file ID share one request', async () => {
    let requestCount = 0;
    const service = new LinkAvailabilityService({
        cacheDir: null,
        request: async () => {
            requestCount++;
            await new Promise(resolve => setTimeout(resolve, 10));
            return response(200, { success: true, value: { name: 'movie.mkv' } });
        },
        logger: { warn() {}, info() {} }
    });
    const results = await Promise.all([
        service.validate('https://pixeldrain.com/file/shared-id'),
        service.validate('https://pixeldrain.dev/api/file/shared-id?download')
    ]);
    assert.strictEqual(requestCount, 1);
    assert.deepStrictEqual(results.map(result => result.status), ['available', 'available']);
});

test('available result is loaded from the persistent file cache', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-availability-'));
    try {
        let requestCount = 0;
        const options = {
            cacheDir,
            request: async () => {
                requestCount++;
                return response(200, { success: true, value: { name: 'movie.mkv' } });
            },
            logger: { warn() {}, info() {} }
        };
        await new LinkAvailabilityService(options).validate('https://pixeldrain.com/file/cache-id');
        const cached = await new LinkAvailabilityService(options).validate('https://pixeldrain.com/file/cache-id');
        assert.strictEqual(requestCount, 1);
        assert.strictEqual(cached.cached, true);
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
});

test('available result is rechecked after its configured cache TTL', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-availability-'));
    try {
        let now = 1000;
        let requestCount = 0;
        const service = new LinkAvailabilityService({
            cacheDir,
            now: () => now,
            availableTtlMs: 2000,
            request: async () => {
                requestCount++;
                return response(200, { success: true, value: { name: 'movie.mkv' } });
            },
            logger: { warn() {}, info() {} }
        });
        const url = 'https://pixeldrain.com/file/ttl-id';
        await service.validate(url);
        now += 2001;
        const refreshed = await service.validate(url);
        assert.strictEqual(requestCount, 2);
        assert.strictEqual(refreshed.cached, false);
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
});

test('quota result is cached for its configured cooldown', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'link-availability-'));
    try {
        let requestCount = 0;
        const service = new LinkAvailabilityService({
            cacheDir,
            quotaTtlMs: 60_000,
            request: async () => {
                requestCount++;
                return response(403, { error: { errors: [{ reason: 'downloadQuotaExceeded' }] } });
            },
            logger: { warn() {}, info() {} }
        });
        await service.validate('https://drive.google.com/uc?id=quota-id');
        const cached = await service.validate('https://drive.google.com/uc?id=quota-id');
        assert.strictEqual(requestCount, 1);
        assert.strictEqual(cached.status, 'quota_exceeded');
        assert.strictEqual(cached.cached, true);
    } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
});

test('candidate filtering removes only confirmed failures and ranks available first', async () => {
    const service = new LinkAvailabilityService({
        cacheDir: null,
        request: async ({ url }) => {
            if (url.includes('available-id')) return response(200, { success: true, value: { name: 'movie.mkv' } });
            if (url.includes('missing-id')) return response(404);
            return response(403, { error: { message: 'Forbidden' } });
        },
        logger: { warn() {}, info() {} }
    });
    const candidates = await service.validateCandidates([
        { url: 'https://pixeldrain.com/file/unknown-id', label: 'unknown' },
        { url: 'https://pixeldrain.com/file/missing-id', label: 'missing' },
        { url: 'https://pixeldrain.com/file/available-id', label: 'available' }
    ]);
    assert.deepStrictEqual(candidates.map(candidate => candidate.label), ['available', 'unknown']);
    assert.strictEqual(candidates[1].linkAvailability.status, 'unknown');
    assert.strictEqual(candidates[0].linkAvailability.playbackTested, false);
});

test('mirrors resolving to the same host and file ID are deduplicated', async () => {
    let requestCount = 0;
    const service = new LinkAvailabilityService({
        cacheDir: null,
        request: async () => {
            requestCount++;
            return response(200, { success: true, value: { name: 'movie.mkv' } });
        },
        logger: { warn() {}, info() {} }
    });
    const candidates = await service.validateCandidates([
        { url: 'https://pixeldrain.com/file/duplicate-id', label: 'first' },
        { url: 'https://pixeldrain.dev/api/file/duplicate-id?download', label: 'second' }
    ]);
    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].label, 'first');
    assert.strictEqual(requestCount, 1);
});

test('availability requests are bounded and use byte-range probes for Drive', async () => {
    let active = 0;
    let maxActive = 0;
    let sawRangeRequest = false;
    const service = new LinkAvailabilityService({
        cacheDir: null,
        concurrency: 2,
        request: async options => {
            active++;
            maxActive = Math.max(maxActive, active);
            if (options.headers?.Range === 'bytes=0-0') sawRangeRequest = true;
            await new Promise(resolve => setTimeout(resolve, 10));
            active--;
            return response(206, '', { 'content-type': 'video/mp4' });
        },
        logger: { warn() {}, info() {} }
    });
    const candidates = await service.validateCandidates([
        { url: 'https://drive.google.com/uc?id=file-a' },
        { url: 'https://drive.google.com/uc?id=file-b' },
        { url: 'https://drive.google.com/uc?id=file-c' }
    ]);
    assert.strictEqual(candidates.length, 3);
    assert.strictEqual(sawRangeRequest, true);
    assert.strictEqual(maxActive, 2);
});

test('concurrency limit is shared across simultaneous candidate batches', async () => {
    let active = 0;
    let maxActive = 0;
    const service = new LinkAvailabilityService({
        cacheDir: null,
        concurrency: 1,
        request: async () => {
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise(resolve => setTimeout(resolve, 10));
            active--;
            return response(200, { success: true, value: { name: 'movie.mkv' } });
        },
        logger: { warn() {}, info() {} }
    });
    await Promise.all([
        service.validateCandidates([{ url: 'https://pixeldrain.com/file/batch-one' }]),
        service.validateCandidates([{ url: 'https://pixeldrain.com/file/batch-two' }])
    ]);
    assert.strictEqual(maxActive, 1);
});

test('stable identifiers ignore URL presentation variants', () => {
    const first = identifyLink('https://pixeldrain.com/file/stable-id?download=1#video');
    const second = identifyLink('https://pixeldrain.dev/api/file/stable-id');
    assert.strictEqual(first.key, second.key);
});

(async () => {
    let failures = 0;
    for (const { name, callback } of tests) {
        try {
            await callback();
            console.log(`PASS ${name}`);
        } catch (error) {
            failures++;
            console.error(`FAIL ${name}`);
            console.error(error.stack || error);
        }
    }
    console.log(`\n${tests.length - failures}/${tests.length} tests passed`);
    if (failures > 0) process.exitCode = 1;
})();
