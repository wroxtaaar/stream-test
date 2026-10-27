const axios = require('axios');

const RETRYABLE_CODES = new Set([
    'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN',
    'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE'
]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Axios GET with bounded retries for transient upstream/network failures.
 * HTTP 4xx errors other than 429 are not retried.
 */
async function getWithRetry(url, options = {}, maxAttempts = 3) {
    const attempts = Math.max(1, Math.min(Number.isInteger(maxAttempts) ? maxAttempts : 3, 3));
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await axios.get(url, options);
        } catch (error) {
            const status = error.response && error.response.status;
            const retryable = RETRYABLE_CODES.has(error.code) ||
                status === 429 || (status >= 500 && status <= 599);
            if (!retryable || attempt === attempts) throw error;
            await sleep(250 * (2 ** (attempt - 1)));
        }
    }
}

module.exports = { getWithRetry };
