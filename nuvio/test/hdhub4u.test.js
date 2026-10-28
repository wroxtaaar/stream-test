const assert = require('assert');
const {
    parseSearchResults,
    selectBestMatch,
    toAbsoluteHttpUrl
} = require('../providers/hdhub4u');

const searchHtml = `
    <figure><img src="/matrix.jpg"></figure>
    <figcaption><a href="/the-matrix-1999/"><p>The Matrix (1999)</p></a></figcaption>
    <figure><img src="/resurrections.jpg"></figure>
    <figcaption><a href="https://hdhub4u.example/matrix-resurrections/"><p>The Matrix Resurrections (2021)</p></a></figcaption>
`;
const searchBase = 'https://hdhub4u.example/search/';

const tests = [
    ['selects Matrix and never the similar-title distractor', () => {
        const results = parseSearchResults(searchHtml, searchBase);
        const selected = selectBestMatch(results, 'The Matrix', '1999', 'movie', null);

        assert.strictEqual(results.length, 2);
        assert.strictEqual(selected.title, 'The Matrix (1999)');
        assert.strictEqual(selected.url, 'https://hdhub4u.example/the-matrix-1999/');
        assert.notStrictEqual(selected.url, 'https://hdhub4u.example/matrix-resurrections/');
    }],
    ['rejects a similar-title result when no exact title result exists', () => {
        const distractorOnly = parseSearchResults(`
            <figcaption><a href="/matrix-resurrections/"><p>The Matrix Resurrections (2021)</p></a></figcaption>
        `, searchBase);

        assert.strictEqual(selectBestMatch(distractorOnly, 'The Matrix', '1999', 'movie', null), null);
    }],
    ['rejects an exact title with a conflicting release year', () => {
        const wrongYear = [{ title: 'The Matrix (2003)', url: 'https://hdhub4u.example/wrong-year/' }];
        assert.strictEqual(selectBestMatch(wrongYear, 'The Matrix', '1999', 'movie', null), null);
    }],
    ['matches the requested TV season without accepting a different season', () => {
        const seasonResults = [
            { title: 'Example Show Season 2', url: 'https://hdhub4u.example/s2/' },
            { title: 'Example Show Season 1', url: 'https://hdhub4u.example/s1/' }
        ];
        assert.strictEqual(
            selectBestMatch(seasonResults, 'Example Show', null, 'tv', 1).url,
            'https://hdhub4u.example/s1/'
        );
    }],
    ['resolves relative URLs and preserves valid absolute HTTP(S) URLs', () => {
        assert.strictEqual(
            toAbsoluteHttpUrl('../matrix/', searchBase),
            'https://hdhub4u.example/matrix/'
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
