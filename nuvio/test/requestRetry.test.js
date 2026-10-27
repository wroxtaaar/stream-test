const assert = require('assert');
const axios = require('axios');
const { getWithRetry } = require('../utils/requestRetry');

const originalGet = axios.get;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

    console.log(`\\n${passed}/3 request retry tests passed`);
    if (passed !== 3) process.exitCode = 1;
}
run().finally(() => { axios.get = originalGet; });
