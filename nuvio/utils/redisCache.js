require('dotenv').config();
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

// Debug logging flag - set DEBUG=true to enable verbose logging
const DEBUG = process.env.DEBUG === 'true' || process.env.REDIS_CACHE_DEBUG === 'true';
const log = DEBUG ? console.log : () => {};
const logWarn = DEBUG ? console.warn : () => {};
const FILE_CACHE_ENTRY_MARKER = '__nuvioCacheEntry';

// Redis Cache Utility for NuvioStreams Providers
class RedisCache {
    constructor(providerName = 'Generic') {
        this.providerName = providerName;
        this.redisClient = null;
        this.redisKeepAliveInterval = null;
        this.initializeRedis();
    }

    initializeRedis() {
        if (process.env.USE_REDIS_CACHE === 'true') {
            try {
                log(`[${this.providerName} Cache] Initializing Redis. REDIS_URL from env: ${process.env.REDIS_URL ? 'exists and has value' : 'MISSING or empty'}`);
                if (!process.env.REDIS_URL) {
                    throw new Error(`REDIS_URL environment variable is not set or is empty for ${this.providerName} Redis.`);
                }

                // Check if this is a local Redis instance or remote
                const isLocal = process.env.REDIS_URL.includes('localhost') || process.env.REDIS_URL.includes('127.0.0.1');
                
                this.redisClient = new Redis(process.env.REDIS_URL, {
                    maxRetriesPerRequest: 5,
                    retryStrategy(times) {
                        const delay = Math.min(times * 500, 5000);
                        return delay;
                    },
                    reconnectOnError: function(err) {
                        const targetError = 'READONLY';
                        if (err.message.includes(targetError)) {
                            return true;
                        }
                        return false;
                    },
                    // TLS is optional - only use if explicitly specified with rediss:// protocol
                     tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
                    enableOfflineQueue: true,
                    enableReadyCheck: true,
                    autoResubscribe: true,
                    autoResendUnfulfilledCommands: true,
                    lazyConnect: false
                });

                this.redisClient.on('connect', () => {
                    log(`[${this.providerName} Cache] Successfully connected to Redis server.`);
                    
                    // Redis Keep-Alive for managed services like Upstash
                    if (this.redisKeepAliveInterval) {
                        clearInterval(this.redisKeepAliveInterval);
                    }
                    this.redisKeepAliveInterval = setInterval(async () => {
                        try {
                            await this.redisClient.ping();
                        } catch (pingError) {
                            logWarn(`[${this.providerName} Cache] Redis keep-alive ping failed: ${pingError.message}`);
                        }
                    }, 4 * 60 * 1000); // 4 minutes
                });

                this.redisClient.on('error', (err) => {
                    console.error(`[${this.providerName} Cache] Redis connection error: ${err.message}`);
                });

                this.redisClient.on('close', () => {
                    log(`[${this.providerName} Cache] Redis connection closed.`);
                    if (this.redisKeepAliveInterval) {
                        clearInterval(this.redisKeepAliveInterval);
                        this.redisKeepAliveInterval = null;
                    }
                });

            } catch (initError) {
                console.error(`[${this.providerName} Cache] Failed to initialize Redis client: ${initError.message}`);
                this.redisClient = null;
            }
        } else {
            log(`[${this.providerName} Cache] Redis cache is disabled (USE_REDIS_CACHE is not 'true'). Using file system cache only.`);
        }
    }

    async getFromCache(cacheKey, subDir = '', cacheDir = null) {
        if (process.env.DISABLE_CACHE === 'true') {
            log(`[${this.providerName} Cache] CACHE DISABLED: Skipping read for ${path.join(subDir, cacheKey)}`);
            return null;
        }

        const fullCacheKey = subDir ? `${this.providerName.toLowerCase()}:${subDir}:${cacheKey}` : `${this.providerName.toLowerCase()}:${cacheKey}`;

        // Try to get from Redis first
        if (this.redisClient && this.redisClient.status === 'ready') {
            try {
                const redisData = await this.redisClient.get(fullCacheKey);
                if (redisData !== null) {
                    log(`[${this.providerName} Cache] REDIS CACHE HIT for: ${fullCacheKey}`);
                    try {
                        return JSON.parse(redisData);
                    } catch (e) {
                        return redisData;
                    }
                }
                log(`[${this.providerName} Cache] REDIS CACHE MISS for: ${fullCacheKey}`);
            } catch (redisError) {
                logWarn(`[${this.providerName} Cache] REDIS CACHE READ ERROR for ${fullCacheKey}: ${redisError.message}. Falling back to file system cache.`);
            }
        } else if (this.redisClient) {
            log(`[${this.providerName} Cache] Redis client not ready (status: ${this.redisClient.status}). Skipping Redis read for ${fullCacheKey}, trying file system.`);
        }

        // Fallback to file system cache
        if (cacheDir) {
            const cachePath = path.join(cacheDir, subDir, `${cacheKey}.json`);
            try {
                const fileData = await fs.readFile(cachePath, 'utf-8');
                let cachedData;
                let hasExpiration = false;
                let remainingTtlSeconds;
                try {
                    cachedData = JSON.parse(fileData);
                } catch (parseError) {
                    cachedData = fileData;
                }

                if (cachedData && cachedData[FILE_CACHE_ENTRY_MARKER] === true) {
                    const expiresAt = cachedData.expiresAt;
                    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                        log(`[${this.providerName} Cache] FILE SYSTEM CACHE EXPIRED for: ${path.join(subDir, cacheKey)}`);
                        return null;
                    }
                    remainingTtlSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
                    hasExpiration = true;
                    cachedData = cachedData.value;
                    if (typeof cachedData === 'string') {
                        try {
                            cachedData = JSON.parse(cachedData);
                        } catch (parseError) {
                            // Preserve non-JSON string cache values.
                        }
                    }
                }

                log(`[${this.providerName} Cache] FILE SYSTEM CACHE HIT for: ${path.join(subDir, cacheKey)}`);
                
                // Preserve the file entry's remaining lifetime when warming Redis.
                if (this.redisClient && this.redisClient.status === 'ready') {
                    try {
                        const redisData = typeof cachedData === 'string' ? cachedData : JSON.stringify(cachedData);
                        if (hasExpiration) {
                            await this.redisClient.setex(fullCacheKey, remainingTtlSeconds, redisData);
                        } else {
                            await this.redisClient.set(fullCacheKey, redisData);
                        }
                    } catch (redisSetError) {
                        logWarn(`[${this.providerName} Cache] REDIS CACHE SET ERROR (after file read) for ${fullCacheKey}: ${redisSetError.message}`);
                    }
                }

                return cachedData;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    logWarn(`[${this.providerName} Cache] FILE SYSTEM CACHE READ ERROR for ${cacheKey}: ${error.message}`);
                } else {
                    log(`[${this.providerName} Cache] FILE SYSTEM CACHE MISS for: ${path.join(subDir, cacheKey)}`);
                }
                return null;
            }
        }

        return null;
    }

    async saveToCache(cacheKey, content, subDir = '', cacheDir = null, ttlSeconds = null) {
        if (process.env.DISABLE_CACHE === 'true') {
            log(`[${this.providerName} Cache] CACHE DISABLED: Skipping write for ${path.join(subDir, cacheKey)}`);
            return;
        }

        const dataToSave = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        const hasExpiration = Number.isFinite(ttlSeconds) && ttlSeconds > 0;
        const fileDataToSave = hasExpiration
            ? JSON.stringify({
                [FILE_CACHE_ENTRY_MARKER]: true,
                expiresAt: Date.now() + ttlSeconds * 1000,
                value: content
            })
            : dataToSave;
        const fullCacheKey = subDir ? `${this.providerName.toLowerCase()}:${subDir}:${cacheKey}` : `${this.providerName.toLowerCase()}:${cacheKey}`;

        // Attempt to save to Redis first with optional TTL
        if (this.redisClient && this.redisClient.status === 'ready') {
            try {
                if (ttlSeconds) {
                    await this.redisClient.setex(fullCacheKey, ttlSeconds, dataToSave);
                    log(`[${this.providerName} Cache] SAVED TO REDIS CACHE: ${fullCacheKey} (TTL: ${ttlSeconds}s)`);
                } else {
                    await this.redisClient.set(fullCacheKey, dataToSave);
                    log(`[${this.providerName} Cache] SAVED TO REDIS CACHE: ${fullCacheKey} (PERMANENT - no expiration)`);
                }
            } catch (redisError) {
                logWarn(`[${this.providerName} Cache] REDIS CACHE WRITE ERROR for ${fullCacheKey}: ${redisError.message}. Proceeding with file system cache.`);
            }
        } else if (this.redisClient) {
            log(`[${this.providerName} Cache] Redis client not ready (status: ${this.redisClient.status}). Skipping Redis write for ${fullCacheKey}.`);
        }

        // Always save to file system cache as a fallback
        if (cacheDir) {
            try {
                const fullSubDir = path.join(cacheDir, subDir);
                await this.ensureCacheDir(fullSubDir);
                const cachePath = path.join(fullSubDir, `${cacheKey}.json`);
                await fs.writeFile(cachePath, fileDataToSave, 'utf-8');
                log(`[${this.providerName} Cache] SAVED TO FILE SYSTEM CACHE: ${path.join(subDir, cacheKey)}`);
            } catch (error) {
                logWarn(`[${this.providerName} Cache] FILE SYSTEM CACHE WRITE ERROR for ${cacheKey}: ${error.message}`);
            }
        }
    }

    // TTL method removed - all cache entries are now permanent
    // getTTLForSubDir(subDir) {
    //     // This method is no longer used as all cache entries are permanent
    //     // Previously configured TTL based on data type but now all data persists indefinitely
    // }

    async ensureCacheDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                logWarn(`[${this.providerName} Cache] Warning: Could not create cache directory ${dirPath}: ${error.message}`);
            }
        }
    }

    // Cleanup method
    cleanup() {
        if (this.redisKeepAliveInterval) {
            clearInterval(this.redisKeepAliveInterval);
            this.redisKeepAliveInterval = null;
        }
        if (this.redisClient) {
            this.redisClient.disconnect();
            this.redisClient = null;
        }
    }
}

module.exports = RedisCache;