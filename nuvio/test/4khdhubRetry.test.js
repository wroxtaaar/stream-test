const assert = require('assert');
const axios = require('axios');
const { getTmdbDetails } = require('../providers/4khdhub');

const originalGet = axios.get;

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

    await test('4KHDHub retries a transient TMDB connection reset', async () => {
        let calls = 0;
        axios.get = async (_url, options) => {
            calls++;
            assert.strictEqual(options.timeout, 10000);
            if (calls === 1) {
                const error = new Error('connection reset');
                error.code = 'ECONNRESET';
                throw error;
            }
            return {
                data: {
                    title: 'Test Movie',
                    release_date: '2024-01-01'
                }
            };
        };

        assert.deepStrictEqual(await getTmdbDetails('123', 'movie'), {
            title: 'Test Movie',
            year: 2024
        });
        assert.strictEqual(calls, 2);
    });

    await test('4KHDHub retries a TMDB request timeout', async () => {
        let calls = 0;
        axios.get = async () => {
            calls++;
            if (calls === 1) {
                const error = new Error('request timed out');
                error.code = 'ETIMEDOUT';
                throw error;
            }
            return { data: { name: 'Test Series', first_air_date: '2023-02-01' } };
        };

        assert.deepStrictEqual(await getTmdbDetails('123', 'series'), {
            title: 'Test Series',
            year: 2023
        });
        assert.strictEqual(calls, 2);
    });

    await test('4KHDHub does not retry permanent TMDB authentication failures', async () => {
        for (const status of [401, 403]) {
            let calls = 0;
            axios.get = async () => {
                calls++;
                const error = new Error('unauthorized');
                error.response = { status };
                throw error;
            };

            assert.strictEqual(await getTmdbDetails('123', 'movie'), null);
            assert.strictEqual(calls, 1);
        }
    });

    await test('4KHDHub bounds retries when TMDB remains unavailable', async () => {
        let calls = 0;
        axios.get = async () => {
            calls++;
            const error = new Error('TMDB unavailable');
            error.response = { status: 503 };
            throw error;
        };

        assert.strictEqual(await getTmdbDetails('123', 'series'), null);
        assert.strictEqual(calls, 3);
    });

    console.log(`\n${passed}/4 4KHDHub TMDB retry tests passed`);
    if (passed !== 4) process.exitCode = 1;
}

run().finally(() => {
    axios.get = originalGet;
});
