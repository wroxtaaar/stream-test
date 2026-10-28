const assert = require('assert');
const {
    buildResourceUrl,
    deduplicateStreams,
    getConfiguredAddons,
    isHttpUrl,
    normalizeStream,
    queryConfiguredAddons,
    queryOneAddon,
    toNuvioStreams,
    validateManifest
} = require('../utils/stremioAddonAdapter');

const manifest = {
    id: 'test.stremio.addon',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt', 'tmdb']
};
const addon = {
    id: 'test',
    name: 'Test Addon',
    enabled: true,
    manifestUrl: 'https://addon.example/prefix/manifest.json?token=private-token'
};

async function run() {
    let passed = 0;
    async function test(name, fn) {
        try {
            await fn();
            passed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            console.error(`FAIL ${name}: ${error.stack || error}`);
            process.exitCode = 1;
        }
    }

    await test('validates manifest resources, content type, and ID prefixes', () => {
        assert.strictEqual(validateManifest(manifest, 'movie', 'tt0133093'), null);
        assert.strictEqual(validateManifest(manifest, 'series', 'tmdb:123:1:2'), null);
        assert.strictEqual(validateManifest({ ...manifest, resources: ['catalog'] }, 'movie', 'tt1'), 'Addon does not support this stream type');
        assert.strictEqual(validateManifest({ ...manifest, types: ['series'] }, 'movie', 'tt1'), 'Addon does not support this stream type');
        assert.strictEqual(validateManifest({ ...manifest, idPrefixes: ['tt'] }, 'movie', 'tmdb:1'), 'Addon does not support this ID format');
        assert.strictEqual(validateManifest({}, 'movie', 'tt1'), 'Invalid Stremio manifest');
    });

    await test('constructs the documented Stremio stream endpoint under a manifest path prefix', () => {
        assert.strictEqual(
            buildResourceUrl(addon.manifestUrl, 'stream', 'movie', 'tt0133093'),
            'https://addon.example/prefix/stream/movie/tt0133093.json?token=private-token'
        );
        assert.strictEqual(
            buildResourceUrl(addon.manifestUrl, 'stream', 'series', 'tmdb:1:2:3'),
            'https://addon.example/prefix/stream/series/tmdb%3A1%3A2%3A3.json?token=private-token'
        );
    });

    await test('queries and validates the real upstream manifest before stream lookup', async () => {
        const urls = [];
        const timeouts = [];
        const response = await queryOneAddon(addon, 'movie', 'tt0133093', async (url, options) => {
            urls.push(url);
            timeouts.push(options.timeout);
            return urls.length === 1
                ? { data: manifest }
                : { data: { streams: [{ name: 'Alpha', source: 'Alpha', title: 'The Matrix 1080p', url: 'https://media.example/matrix.mp4', quality: '1080p' }] } };
        });
        assert.strictEqual(urls.length, 2);
        assert.deepStrictEqual(timeouts, [5000, 10000]);
        assert.strictEqual(urls[0], addon.manifestUrl);
        assert.strictEqual(new URL(urls[1]).pathname, '/prefix/stream/movie/tt0133093.json');
        assert.strictEqual(response.status, 'success');
        assert.strictEqual(response.streams[0].classification, 'playable');
    });

    await test('isolates upstream timeout and HTTP errors with sanitized messages', async () => {
        const timeout = Object.assign(new Error('request timeout'), { code: 'ECONNABORTED' });
        const timeoutResult = await queryOneAddon(addon, 'movie', 'tt1', async () => { throw timeout; });
        assert.strictEqual(timeoutResult.status, 'timeout');
        assert.strictEqual(timeoutResult.error, 'Upstream timed out');

        const httpError = Object.assign(new Error('private request URL'), { response: { status: 503 } });
        const errorResult = await queryOneAddon(addon, 'movie', 'tt1', async () => { throw httpError; });
        assert.strictEqual(errorResult.status, 'error');
        assert.strictEqual(errorResult.error, 'Upstream returned HTTP 503');
        assert(!JSON.stringify(errorResult).includes('private request URL'));
        assert(!JSON.stringify(errorResult).includes('private-token'));
    });

    await test('rejects malformed, empty, and unsupported stream responses', async () => {
        const resultFor = data => {
            let calls = 0;
            return queryOneAddon(addon, 'movie', 'tt1', async () =>
                ++calls === 1 ? { data: manifest } : { data }
            );
        };
        assert.strictEqual((await resultFor({ streams: {} })).status, 'invalid_response');
        assert.strictEqual((await resultFor({ streams: [] })).status, 'empty');
        assert.strictEqual((await resultFor({ streams: [null, {}] })).status, 'invalid_results');
        const unsupported = await queryOneAddon(addon, 'movie', 'tt1', async () => ({
            data: { ...manifest, resources: ['catalog'] }
        }));
        assert.strictEqual(unsupported.status, 'unsupported');

        const manifestUrlAsStream = await queryOneAddon(addon, 'movie', 'tt1', async url =>
            url === addon.manifestUrl
                ? { data: manifest }
                : { data: { streams: [{ url: 'https://addon.example/prefix/manifest.json?token=private-token' }] } }
        );
        assert.strictEqual(manifestUrlAsStream.streams[0].classification, 'unavailable');
        assert(!JSON.stringify(manifestUrlAsStream).includes('private-token'));
    });

    await test('retains useful optional release metadata and handles missing metadata', () => {
        const rich = normalizeStream({
            name: 'Remux',
            title: 'Example 2160p',
            source: 'Release Group A',
            url: 'https://media.example/file.mkv',
            quality: '2160p',
            filename: 'example.mkv',
            languages: ['English', 'French'],
            audioTracks: ['DTS-HD MA', 'Atmos'],
            codec: 'HEVC',
            releaseInfo: 'Remux',
            releaseGroup: 'GroupA',
            size: '40 GB',
            seeders: 42
        }, addon);
        assert.strictEqual(rich.classification, 'playable');
        assert.deepStrictEqual(rich.languages, ['English', 'French']);
        assert.strictEqual(rich.audio, 'DTS-HD MA, Atmos');
        assert.strictEqual(rich.filename, 'example.mkv');
        assert.strictEqual(rich.releaseGroup, 'GroupA');
        assert.strictEqual(normalizeStream({ url: 'https://media.example/minimal' }, addon).classification, 'playable');
        assert.strictEqual(normalizeStream(null, addon).classification, 'unavailable');
        const sanitized = normalizeStream({
            source: 'https://addon.example/manifest.json?token=private',
            title: 'Release api_key=secret-value',
            url: 'https://media.example/file'
        }, addon);
        assert(!JSON.stringify(sanitized).includes('addon.example'));
        assert(!JSON.stringify(sanitized).includes('secret-value'));
    });

    await test('deduplicates exact stream copies but retains distinct releases and source attribution', () => {
        const base = normalizeStream({
            source: 'Provider A',
            title: 'Film 1080p',
            quality: '1080p',
            filename: 'film-1080.mkv',
            language: 'English',
            url: 'https://media.example/file'
        }, addon);
        const copy = { ...base, source: 'Provider B' };
        const otherRelease = normalizeStream({
            source: 'Provider C',
            title: 'Film 2160p',
            quality: '2160p',
            filename: 'film-2160.mkv',
            language: 'English',
            url: 'https://media.example/file'
        }, addon);
        const unique = deduplicateStreams([base, copy, otherRelease]);
        assert.strictEqual(unique.length, 2);
        assert.deepStrictEqual(unique[0].sources, ['Provider A', 'Provider B']);
        assert.strictEqual(unique[1].quality, '2160p');
    });

    await test('classifies torrents as discovered and never converts raw hashes to playable URLs', () => {
        const discovered = normalizeStream({
            infoHash: '0123456789abcdef0123456789abcdef01234567',
            fileIdx: 2,
            title: 'Legal test torrent'
        }, addon);
        const magnet = normalizeStream({
            url: 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Legal+test&tr=https%3A%2F%2Ftracker.example%2Fsecret'
        }, addon);
        assert.strictEqual(discovered.classification, 'discovered');
        assert.strictEqual(discovered.url, undefined);
        assert.strictEqual(magnet.classification, 'discovered');
        assert.strictEqual(magnet.infoHash, '0123456789abcdef0123456789abcdef01234567');
        assert(!magnet.magnet.includes('tracker.example'));
        assert.strictEqual(normalizeStream({ infoHash: 'not-a-hash' }, addon).classification, 'unavailable');
        assert.deepStrictEqual(toNuvioStreams([{ name: 'Magnetio', streams: [discovered, magnet] }]), []);
        assert.strictEqual(isHttpUrl('javascript:alert(1)'), false);
        assert.strictEqual(isHttpUrl('https://user:pass@media.example/file'), false);
    });

    await test('keeps disabled and unselected integrations from making requests', async () => {
        const disabled = getConfiguredAddons({
            ENABLE_MAGNETIO_ADDON: 'false',
            MAGNETIO_MANIFEST_URL: addon.manifestUrl,
            ENABLE_AIOSTREAMS_ADDON: 'false',
            AIOSTREAMS_MANIFEST_URL: ''
        });
        assert(disabled.every(item => !item.enabled && item.manifestUrl === null));

        let calls = 0;
        const result = await queryConfiguredAddons(
            { type: 'movie', id: 'tt1' },
            {
                env: {
                    ENABLE_MAGNETIO_ADDON: 'true',
                    MAGNETIO_MANIFEST_URL: addon.manifestUrl,
                    ENABLE_AIOSTREAMS_ADDON: 'false'
                },
                selectedProviders: ['aiostreams'],
                request: async () => { calls++; return { data: manifest }; }
            }
        );
        assert.strictEqual(calls, 0);
        assert.strictEqual(result.find(item => item.id === 'magnetio').status, 'not_selected');
    });

    await test('preserves AIOStreams results when Magnetio fails', async () => {
        const result = await queryConfiguredAddons(
            { type: 'movie', id: 'tt1' },
            {
                env: {
                    ENABLE_MAGNETIO_ADDON: 'true',
                    MAGNETIO_MANIFEST_URL: 'https://magnetio.example/manifest.json',
                    ENABLE_AIOSTREAMS_ADDON: 'true',
                    AIOSTREAMS_MANIFEST_URL: 'https://aiostreams.example/manifest.json'
                },
                request: async url => {
                    if (url.startsWith('https://magnetio.')) {
                        const error = new Error('network failure');
                        error.code = 'ECONNRESET';
                        throw error;
                    }
                    return url.endsWith('/manifest.json')
                        ? { data: manifest }
                        : { data: { streams: [{ title: 'Licensed test file', url: 'https://media.example/test.mp4' }] } };
                }
            }
        );
        assert.strictEqual(result.find(item => item.id === 'magnetio').status, 'error');
        assert.strictEqual(result.find(item => item.id === 'aiostreams').status, 'success');
        assert.strictEqual(result.find(item => item.id === 'aiostreams').streams.length, 1);
    });

    await test('reports broken explicitly enabled configuration without exposing its URL', async () => {
        const result = await queryConfiguredAddons(
            { type: 'movie', id: 'tt1' },
            {
                env: {
                    ENABLE_MAGNETIO_ADDON: 'true',
                    MAGNETIO_MANIFEST_URL: 'https://user:pass@addon.example/manifest.json?token=private-token'
                },
                request: async () => { throw new Error('must not fetch invalid URL'); }
            }
        );
        assert.strictEqual(result[0].status, 'invalid_configuration');
        assert(!JSON.stringify(result).includes('private-token'));
        assert(!JSON.stringify(result).includes('user:pass'));
    });

    await test('bounds parallel upstream requests to the configured concurrency', async () => {
        let active = 0;
        let maximum = 0;
        const request = async url => {
            active++;
            maximum = Math.max(maximum, active);
            await new Promise(resolve => setTimeout(resolve, 5));
            active--;
            return url.endsWith('/manifest.json') ? { data: manifest } : { data: { streams: [] } };
        };
        await queryConfiguredAddons(
            { type: 'movie', id: 'tt1' },
            {
                env: {
                    ENABLE_MAGNETIO_ADDON: 'true',
                    MAGNETIO_MANIFEST_URL: 'https://magnetio.example/manifest.json',
                    ENABLE_AIOSTREAMS_ADDON: 'true',
                    AIOSTREAMS_MANIFEST_URL: 'https://aiostreams.example/manifest.json'
                },
                request
            }
        );
        assert(maximum <= 2);
        assert(maximum > 1);
    });

    console.log(`\n${passed}/12 Stremio adapter tests passed`);
    if (passed !== 12) process.exitCode = 1;
}

run();
