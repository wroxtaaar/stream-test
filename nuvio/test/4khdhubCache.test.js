const assert = require('assert');
const axios = require('axios');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const rot13Cipher = require('rot13-cipher');

process.env.USE_REDIS_CACHE = 'false';
process.env.DISABLE_CACHE = 'false';
process.env.VERCEL = 'true';

const RedisCache = require('../utils/redisCache');
const { resolveRedirectUrl, extractHubCloud } = require('../providers/4khdhub');

const tests = [];
function test(name, callback) {
    tests.push({ name, callback });
}

test('fresh file-cache entries remain readable with their TTL', async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuvio-cache-fresh-'));
    const cache = new RedisCache('4KHDHub test');
    const value = { url: 'https://media.example/fresh' };

    try {
        await cache.saveToCache('fresh', value, '', cacheDir, 60);
        assert.deepStrictEqual(await cache.getFromCache('fresh', '', cacheDir), value);
    } finally {
        await fs.rm(cacheDir, { recursive: true, force: true });
        cache.cleanup();
    }
});

test('expired file-cache entries are not returned', async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuvio-cache-expired-'));
    const cache = new RedisCache('4KHDHub test');

    try {
        await cache.saveToCache('expired', { url: 'https://media.example/expired' }, '', cacheDir, 60);
        const cachePath = path.join(cacheDir, 'expired.json');
        const entry = JSON.parse(await fs.readFile(cachePath, 'utf8'));
        entry.expiresAt = Date.now() - 1;
        await fs.writeFile(cachePath, JSON.stringify(entry));
        assert.strictEqual(await cache.getFromCache('expired', '', cacheDir), null);
    } finally {
        await fs.rm(cacheDir, { recursive: true, force: true });
        cache.cleanup();
    }
});

test('Redis-disabled cache reads and writes through the expiring file fallback', async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuvio-cache-file-only-'));
    const cache = new RedisCache('4KHDHub test');
    const value = { data: ['stable metadata'] };

    try {
        assert.strictEqual(cache.redisClient, null);
        await cache.saveToCache('file-only', value, '', cacheDir, 60);
        const savedEntry = JSON.parse(await fs.readFile(path.join(cacheDir, 'file-only.json'), 'utf8'));
        assert.strictEqual(savedEntry.__nuvioCacheEntry, true);
        assert(savedEntry.expiresAt > Date.now());
        assert.deepStrictEqual(await cache.getFromCache('file-only', '', cacheDir), value);
    } finally {
        await fs.rm(cacheDir, { recursive: true, force: true });
        cache.cleanup();
    }
});

test('cached redirect and media URLs are resolved again instead of reused', async () => {
    const oldAxiosGet = axios.get;
    const staleRedirectUrl = 'https://media.example/stale-redirect';
    const freshRedirectUrl = 'https://hubcloud.example/fresh-redirect';
    const redirectPageUrl = `https://redirect.example/test-${process.pid}-${Date.now()}`;
    const hubCloudUrl = `https://hubcloud.example/test-${process.pid}-${Date.now()}`;
    const cacheDir = path.join(os.tmpdir(), '.4khdhub_cache');
    const redirectCacheKey = `redirect_v2_${redirectPageUrl.replace(/[^a-z0-9]/gi, '')}`;
    const mediaCacheKey = `hubcloud_v2_${hubCloudUrl.replace(/[^a-z0-9]/gi, '')}`;
    const testCachePaths = [
        path.join(cacheDir, `${redirectCacheKey}.json`),
        path.join(cacheDir, `${mediaCacheKey}.json`)
    ];
    let requestCount = 0;

    const redirectJson = JSON.stringify({ o: Buffer.from(freshRedirectUrl).toString('base64') });
    const step3 = Buffer.from(redirectJson).toString('base64');
    const step2 = rot13Cipher(step3);
    const step1 = Buffer.from(step2).toString('base64');
    const redirectEncoded = Buffer.from(step1).toString('base64');

    try {
        await fs.mkdir(cacheDir, { recursive: true });
        await Promise.all(testCachePaths.map((cachePath, index) =>
            fs.writeFile(cachePath, JSON.stringify({
                data: [{ source: 'FSL', url: index === 0 ? staleRedirectUrl : 'https://media.example/stale-media' }]
            }))
        ));

        axios.get = async url => {
            requestCount++;
            if (url === redirectPageUrl) return { data: `'o','${redirectEncoded}'` };
            if (url === hubCloudUrl) return { data: `var url = '${freshRedirectUrl}'` };
            if (url === freshRedirectUrl) {
                return {
                    data: '<div id="size">1 GB</div><title>Fresh media</title><a href="https://media.example/fresh?signature=valid">FSL Download File</a>'
                };
            }
            throw new Error(`Unexpected mocked request: ${url}`);
        };

        assert.strictEqual(await resolveRedirectUrl(redirectPageUrl), freshRedirectUrl);
        const streams = await extractHubCloud(hubCloudUrl, { bytes: 0, title: 'Source title' });
        assert.strictEqual(streams.length, 1);
        assert.strictEqual(streams[0].url, 'https://media.example/fresh?signature=valid');
        assert.strictEqual(requestCount, 3);
    } finally {
        axios.get = oldAxiosGet;
        await Promise.all(testCachePaths.map(cachePath => fs.rm(cachePath, { force: true })));
    }
});

async function run() {
    let passed = 0;
    for (const { name, callback } of tests) {
        try {
            await callback();
            passed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            console.error(`FAIL ${name}: ${error.stack || error}`);
            process.exitCode = 1;
        }
    }

    console.log(`\n${passed}/${tests.length} 4KHDHub cache tests passed`);
    if (passed !== tests.length) process.exitCode = 1;
}

run();
