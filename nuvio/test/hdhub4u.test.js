const assert = require('assert');
const axios = require('axios');
const { spawnSync } = require('child_process');
const {
    parseSearchResults,
    selectBestMatch,
    filterLinksForEpisode,
    toAbsoluteHttpUrl,
    normalizeArticleUrl,
    getRedirectLinks,
    loadExtractor,
    hbLinksExtractor
} = require('../providers/hdhub4u');

const searchHtml = `
    <figure><img src="/matrix.jpg"></figure>
    <figcaption><a href="/the-matrix-1999/"><p>The Matrix (1999)</p></a></figcaption>
    <figure><img src="/resurrections.jpg"></figure>
    <figcaption><a href="https://provider.example/matrix-resurrections/"><p>The Matrix Resurrections (2021)</p></a></figcaption>
`;
const searchBase = 'https://provider.example/search/';

const base64 = value => Buffer.from(value, 'utf8').toString('base64');
const rot13 = value => value.replace(/[a-zA-Z]/g, c => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(base + ((code - base + 13) % 26));
});
const encodedRedirectPayload = blogUrl => {
    const json = JSON.stringify({ blog_url: blogUrl, data: 'payload' });
    return base64(base64(rot13(base64(json))));
};

const tests = [
    ['selects Matrix and never the similar-title distractor', () => {
        const results = parseSearchResults(searchHtml, searchBase);
        const selected = selectBestMatch(results, 'The Matrix', '1999', 'movie', null);

        assert.strictEqual(results.length, 2);
        assert.strictEqual(selected.title, 'The Matrix (1999)');
        assert.strictEqual(selected.url, 'https://provider.example/the-matrix-1999/');
        assert.notStrictEqual(selected.url, 'https://provider.example/matrix-resurrections/');
    }],
    ['rejects a similar-title result when no exact title result exists', () => {
        const distractorOnly = parseSearchResults(`
            <figcaption><a href="/matrix-resurrections/"><p>The Matrix Resurrections (2021)</p></a></figcaption>
        `, searchBase);

        assert.strictEqual(selectBestMatch(distractorOnly, 'The Matrix', '1999', 'movie', null), null);
    }],
    ['rejects an exact title with a conflicting release year', () => {
        const wrongYear = [{ title: 'The Matrix (2003)', url: 'https://provider.example/wrong-year/' }];
        assert.strictEqual(selectBestMatch(wrongYear, 'The Matrix', '1999', 'movie', null), null);
    }],
    ['normalizes stale HDHub4u article URLs and preserves path, query, and fragment', () => {
        assert.strictEqual(
            normalizeArticleUrl('https://new2.hdhub4u.free/the-matrix-1999-bluray/?x=1#links'),
            'https://hdhub4u.frl/the-matrix-1999-bluray/?x=1#links'
        );
    }],
    ['keeps already-current HDHub4u article URLs unchanged', () => {
        const currentUrl = 'https://hdhub4u.frl/the-matrix-1999-bluray/?x=1';
        assert.strictEqual(normalizeArticleUrl(currentUrl), currentUrl);
    }],
    ['does not rewrite external download-host URLs', () => {
        const downloadUrl = 'https://hubdrive.fit/download/the-matrix';
        assert.strictEqual(normalizeArticleUrl(downloadUrl), downloadUrl);
    }],
    ['does not rewrite lookalike or unrecognized HDHub4u domains', () => {
        const lookalikes = [
            'https://hdhub4u.example/the-matrix-1999/',
            'https://new2.hdhub4u.evil/the-matrix-1999/',
            'https://evil-hdhub4u.com/the-matrix-1999/',
            'https://hdhub4u-cl.com/the-matrix-1999/',
            'https://hdhub4u.com.evil.example/the-matrix-1999/'
        ];
        for (const url of lookalikes) {
            assert.strictEqual(normalizeArticleUrl(url), url);
        }
    }],
    ['normalizes WordPress search results before selecting the article', () => {
        const results = parseSearchResults(`
            <figcaption>
                <a href="https://new2.hdhub4u.free/the-matrix-1999-bluray/?x=1">
                    <p>The Matrix (1999)</p>
                </a>
            </figcaption>
        `);
        const selected = selectBestMatch(results, 'The Matrix', '1999', 'movie', null);

        assert.strictEqual(selected.url, 'https://hdhub4u.frl/the-matrix-1999-bluray/?x=1');
    }],
    ['normalizes stale HDHub4u URLs through the generic search-result fallback', () => {
        const results = parseSearchResults(`
            <article>
                <h3><a href="https://new2.hdhub4u.free/the-matrix-1999-bluray/?x=1#links">The Matrix (1999)</a></h3>
            </article>
        `);
        assert.strictEqual(results[0].url, 'https://hdhub4u.frl/the-matrix-1999-bluray/?x=1#links');
    }],
    ['rejects invalid and credential-bearing WordPress redirect endpoints without a follow-up request', async () => {
        const originalGet = axios.get;
        try {
            for (const blogUrl of ['javascript:alert(1)', 'https://test-user:test-pass@example.com/wp']) {
                let requestCount = 0;
                axios.get = async () => {
                    requestCount++;
                    return {
                        status: 200,
                        data: `<script>s('o','${encodedRedirectPayload(blogUrl)}')</script>`,
                        headers: {}
                    };
                };
                assert.strictEqual(await getRedirectLinks('https://greenmotors.club/?id=mock'), null);
                assert.strictEqual(requestCount, 1);
            }
        } finally {
            axios.get = originalGet;
        }
    }],
    ['proxy-mode logs do not expose URL query tokens or fragments', () => {
        const script = `
            const assert = require('assert');
            const axios = require('axios');
            const originalGet = axios.get;
            const originalLog = console.log;
            const logs = [];

            (async () => {
                try {
                    let requestCount = 0;
                    axios.get = async (requestUrl) => {
                        requestCount++;
                        assert.strictEqual(requestCount, 1);
                        assert.ok(requestUrl.includes('proxy.example'));
                        return { status: 200, data: {}, headers: {} };
                    };
                    console.log = (...args) => logs.push(args.join(' '));

                    const provider = require('./providers/hdhub4u');
                    await provider.makeRequest(
                        'https://files.example/video.mp4?token=super-secret#private',
                        { retryAttempts: 1 }
                    );

                    assert.strictEqual(requestCount, 1);
                    const capturedLogs = logs.join('\\n');
                    assert.ok(!capturedLogs.includes('super-secret'), 'query token leaked into logs');
                    assert.ok(!capturedLogs.includes('#private'), 'fragment leaked into logs');
                    process.stdout.write('sanitized');
                } catch (error) {
                    originalLog(error.stack || error);
                    process.exitCode = 1;
                } finally {
                    axios.get = originalGet;
                    console.log = originalLog;
                }
            })();
        `;
        const result = spawnSync(process.execPath, ['-e', script], {
            cwd: process.cwd(),
            env: { ...process.env, DEBUG: 'true', HDHUB4U_PROXY_URL: 'https://proxy.example' },
            encoding: 'utf8'
        });
        assert.strictEqual(result.status, 0, result.stderr || result.stdout);
        assert.strictEqual(result.stdout, 'sanitized');
    }],
    ['does not dispatch lookalike HBl links hostnames to the archive extractor', async () => {
        const originalGet = axios.get;
        try {
            let requested = false;
            axios.get = async () => {
                requested = true;
                throw new Error('unexpected network request');
            };
            assert.deepStrictEqual(await loadExtractor('https://hblinks.lol.evil.example/archives/66973', 'https://hdhub4u.frl/'), []);
            assert.deepStrictEqual(await loadExtractor('https://evil-hblinks.lol/archives/66973', 'https://hdhub4u.frl/'), []);
            assert.strictEqual(requested, false);
        } finally {
            axios.get = originalGet;
        }
    }],
    ['matches the requested TV season without accepting a different season', () => {
        const seasonResults = [
            { title: 'Example Show Season 2', url: 'https://provider.example/s2/' },
            { title: 'Example Show Season 1', url: 'https://provider.example/s1/' }
        ];
        assert.strictEqual(
            selectBestMatch(seasonResults, 'Example Show', null, 'tv', 1).url,
            'https://provider.example/s1/'
        );
    }],
    ['returns only links for the requested TV episode', () => {
        const episodeLinks = [
            { url: 'https://files.example/s01e01.mp4', episode: 1 },
            { url: 'https://files.example/s01e02.mp4', episode: 2 },
            { url: 'https://files.example/unknown.mp4', episode: null }
        ];
        assert.deepStrictEqual(filterLinksForEpisode(episodeLinks, 2), [episodeLinks[1]]);
    }],
    ['resolves relative URLs and preserves valid absolute HTTP(S) URLs', () => {
        assert.strictEqual(
            toAbsoluteHttpUrl('../matrix/', searchBase),
            'https://provider.example/matrix/'
        );
        assert.strictEqual(
            toAbsoluteHttpUrl('https://files.example/video.mp4', searchBase),
            'https://files.example/video.mp4'
        );
        assert.strictEqual(
            toAbsoluteHttpUrl('http://files.example/video.mp4', searchBase),
            'http://files.example/video.mp4'
        );
    }],
    ['returns null for a confirmed redirector HTTP 404 without returning the original URL', async () => {
        const originalGet = axios.get;
        try {
            axios.get = async () => {
                const error = new Error('Request failed with status code 404');
                error.response = { status: 404 };
                error.code = 'ERR_BAD_RESPONSE';
                throw error;
            };
            const redirectUrl = 'https://greenmotors.club/?id=encoded-secret';
            assert.strictEqual(await getRedirectLinks(redirectUrl), null);
        } finally {
            axios.get = originalGet;
        }
    }],
    ['returns no streams for a confirmed hblinks archive HTTP 404', async () => {
        const originalGet = axios.get;
        try {
            axios.get = async () => {
                const error = new Error('Request failed with status code 404');
                error.response = { status: 404 };
                error.code = 'ERR_BAD_RESPONSE';
                throw error;
            };
            assert.deepStrictEqual(
                await loadExtractor('https://hblinks.lol/archives/66973', 'https://greenmotors.club/?id=encoded-secret'),
                []
            );
        } finally {
            axios.get = originalGet;
        }
    }],
    ['does not treat arbitrary intermediate hosts as playable streams', async () => {
        assert.deepStrictEqual(await loadExtractor('https://intermediate.example/page'), []);
    }],
    ['hbLinks extractor isolates archive failures and returns an empty result', async () => {
        const originalGet = axios.get;
        try {
            axios.get = async () => {
                const error = new Error('archive unavailable');
                error.response = { status: 404 };
                throw error;
            };
            assert.deepStrictEqual(await hbLinksExtractor('https://hblinks.lol/archives/66973', 'https://hdhub4u.frl/'), []);
        } finally {
            axios.get = originalGet;
        }
    }],
    ['does not return an original redirect URL when a page has no supported redirect payload', async () => {
        const originalGet = axios.get;
        try {
            axios.get = async () => ({ status: 200, data: '<html>No redirect payload</html>', headers: {} });
            assert.strictEqual(await getRedirectLinks('https://greenmotors.club/?id=missing'), null);
        } finally {
            axios.get = originalGet;
        }
    }],
    ['rejects non-HTTP schemes and URLs containing credentials', () => {
        const credentialUrl = new URL('https://files.example/video.mp4');
        credentialUrl.username = 'test-user';
        assert.strictEqual(toAbsoluteHttpUrl('javascript:alert(1)', searchBase), null);
        assert.strictEqual(toAbsoluteHttpUrl('data:text/plain,video', searchBase), null);
        assert.strictEqual(toAbsoluteHttpUrl(credentialUrl.toString(), searchBase), null);
        assert.strictEqual(normalizeArticleUrl('javascript:alert(1)'), null);
        assert.strictEqual(normalizeArticleUrl(credentialUrl.toString()), null);
    }]
];

let passed = 0;
(async () => {
    for (const [name, callback] of tests) {
        try {
            await callback();
            passed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            console.error(`FAIL ${name}: ${error.stack || error}`);
            process.exitCode = 1;
        }
    }

    console.log(`\n${passed}/${tests.length} HDHub4u matching tests passed`);
})();
