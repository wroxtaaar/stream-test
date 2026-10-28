const assert = require('assert');
const axios = require('axios');
const http = require('http');
const { getWithRetry } = require('../utils/requestRetry');

const originalGet = axios.get;

async function run() {
    let passed = 0;
    async function test(name, fn) {
        try { await fn(); passed++; console.log(`PASS ${name}`); }
        catch (error) { console.error(`FAIL ${name}: ${error.stack || error}`); process.exitCode = 1; }
        finally { axios.get = originalGet; }
    }

    await test('retries ECONNRESET and returns a successful response', async () => {
        let calls = 0;
        axios.get = async () => {
            if (++calls === 1) { const e = new Error('reset'); e.code = 'ECONNRESET'; throw e; }
            return { data: { ok: true } };
        };
        const response = await getWithRetry('https://example.invalid', {}, 3);
        assert.strictEqual(calls, 2);
        assert.deepStrictEqual(response.data, { ok: true });
    });

    await test('retries 5xx up to three total attempts', async () => {
        let calls = 0;
        axios.get = async () => { calls++; const e = new Error('unavailable'); e.response = { status: 503 }; throw e; };
        await assert.rejects(getWithRetry('https://example.invalid', {}, 3));
        assert.strictEqual(calls, 3);
    });

    await test('does not retry permanent 403 responses', async () => {
        let calls = 0;
        axios.get = async () => { calls++; const e = new Error('forbidden'); e.response = { status: 403 }; throw e; };
        await assert.rejects(getWithRetry('https://example.invalid', {}, 3));
        assert.strictEqual(calls, 1);
    });

    await test('times out a stalled request to a local HTTP server on each attempt', async () => {
        let requests = 0;
        const server = http.createServer(() => {
            requests++;
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });

        try {
            const { port } = server.address();
            await assert.rejects(
                getWithRetry(`http://127.0.0.1:${port}/stalled`, { timeout: 100 }, 3),
                error => error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
            );
            assert.strictEqual(requests, 3);
        } finally {
            server.closeAllConnections();
            await new Promise((resolve, reject) => {
                server.close(error => error ? reject(error) : resolve());
            });
        }
    });

    console.log(`\\n${passed}/4 request retry tests passed`);
    if (passed !== 4) process.exitCode = 1;
}
run().finally(() => { axios.get = originalGet; });
