const assert = require('assert');
const axios = require('axios');

// Mock Axios before loading ShowBox so these tests never make real network calls.
const originalGet = axios.get;
const { convertImdbToTmdb } = require('../providers/Showbox');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    let passed = 0;

    async function test(name, callback) {
        try {
            await callback();
            passed++;
            console.log(`PASS ${name}`);
        } catch (error) {
            console.error(`FAIL ${name}: ${error.stack || error}`);
            process.exitCode = 1;
        } finally {
            axios.get = originalGet;
        }
    }

    await test('transient connection reset retries and then converts IMDb ID', async () => {
        let calls = 0;
        axios.get = async () => {
            calls++;
            if (calls === 1) {
                const error = new Error('read ECONNRESET');
                error.code = 'ECONNRESET';
                throw error;
            }
            return {
                data: {
                    movie_results: [{ id: 107, title: 'Test Movie' }],
                    tv_results: []
                }
            };
        };

        const result = await convertImdbToTmdb('tt90000001', null, 'movie');
        assert.strictEqual(calls, 2);
        assert.deepStrictEqual(result, {
            tmdbId: '107',
            tmdbType: 'movie',
            title: 'Test Movie'
        });
    });

    await test('transient server errors retry up to three total attempts', async () => {
        let calls = 0;
        axios.get = async () => {
            calls++;
            const error = new Error('TMDB unavailable');
            error.response = { status: 503 };
            throw error;
        };

        const result = await convertImdbToTmdb('tt90000002', null, 'movie');
        assert.strictEqual(result, null);
        assert.strictEqual(calls, 3);
    });

    await test('invalid API key response is not retried', async () => {
        let calls = 0;
        axios.get = async () => {
            calls++;
            const error = new Error('Request failed with status code 401');
            error.response = { status: 401 };
            throw error;
        };

        const result = await convertImdbToTmdb('tt90000003', null, 'movie');
        assert.strictEqual(result, null);
        assert.strictEqual(calls, 1);
    });

    await test('successful conversion preserves TV prioritization', async () => {
        let calls = 0;
        axios.get = async () => {
            calls++;
            return {
                data: {
                    movie_results: [{ id: 101, title: 'Movie Variant' }],
                    tv_results: [{ id: 202, name: 'Series Variant' }]
                }
            };
        };

        const result = await convertImdbToTmdb('tt90000004', null, 'series');
        assert.strictEqual(calls, 1);
        assert.deepStrictEqual(result, {
            tmdbId: '202',
            tmdbType: 'tv',
            title: 'Series Variant'
        });
    });

    console.log(`\n${passed}/4 TMDB retry tests passed`);
    if (passed !== 4) process.exitCode = 1;
}

run().finally(() => {
    axios.get = originalGet;
});
