const assert = require('assert');
const {
    parseSearchResults,
    selectBestMatch,
    filterLinksForEpisode,
    toAbsoluteHttpUrl,
    normalizeArticleUrl
} = require('../providers/hdhub4u');

const searchHtml = `
    <figure><img src="/matrix.jpg"></figure>
    <figcaption><a href="/the-matrix-1999/"><p>The Matrix (1999)</p></a></figcaption>
    <figure><img src="/resurrections.jpg"></figure>
    <figcaption><a href="https://provider.example/matrix-resurrections/"><p>The Matrix Resurrections (2021)</p></a></figcaption>
`;
const searchBase = 'https://provider.example/search/';

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
for (const [name, callback] of tests) {
    try {
        callback();
        passed++;
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}: ${error.stack || error}`);
        process.exitCode = 1;
    }
}

console.log(`\n${passed}/${tests.length} HDHub4u matching tests passed`);
