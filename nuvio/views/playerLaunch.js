(function (root, factory) {
  const playerLaunch = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = playerLaunch;
  } else {
    root.NuvioPlayerLaunch = playerLaunch;
  }
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const MX_PLAYER_PACKAGE = 'com.mxtech.videoplayer.ad';
  const MIME_TYPES_BY_EXTENSION = {
    avi: 'video/x-msvideo',
    m3u8: 'application/vnd.apple.mpegurl',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    mpd: 'application/dash+xml',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    ts: 'video/mp2t',
    webm: 'video/webm'
  };

  function parseStreamUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl !== rawUrl.trim()) {
      return null;
    }

    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname ||
          parsed.username || parsed.password) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function getMimeType(stream, parsedUrl) {
    const suppliedMimeType = stream.mimeType || stream.mime_type;
    if (typeof suppliedMimeType === 'string' &&
        /^(video|audio|application)\/(?:[a-z0-9][a-z0-9.+-]*|\*)$/i.test(suppliedMimeType)) {
      return suppliedMimeType;
    }

    const extension = parsedUrl.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    return extension ? MIME_TYPES_BY_EXTENSION[extension] || null : null;
  }

  function hasRequestHeaders(stream) {
    const directHeaders = stream.headers;
    const proxyHeaders = stream.behaviorHints?.proxyHeaders?.request;
    return [directHeaders, proxyHeaders].some(headers =>
      headers && typeof headers === 'object' && Object.keys(headers).length > 0
    );
  }

  function getIntentUrl(stream, rawUrl, parsedUrl) {
    const dataUrl = parsedUrl.host + parsedUrl.pathname + parsedUrl.search;
    const mimeType = getMimeType(stream, parsedUrl);
    const typeParameter = mimeType ? `type=${mimeType};` : '';
    return `intent://${dataUrl}#Intent;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;scheme=${parsedUrl.protocol.slice(0, -1)};` +
      `package=${MX_PLAYER_PACKAGE};${typeParameter}` +
      'end';
  }

  function getPlaybackAction(stream, userAgent) {
    const rawUrl = stream?.url;
    const parsedUrl = parseStreamUrl(rawUrl);
    if (!parsedUrl) return { kind: 'invalid' };

    if (hasRequestHeaders(stream)) {
      return { kind: 'headers-required', url: rawUrl };
    }

    if (!/Android/i.test(userAgent || '')) {
      return { kind: 'browser', url: rawUrl };
    }

    return {
      kind: 'mx-player',
      url: rawUrl,
      intentUrl: getIntentUrl(stream, rawUrl, parsedUrl),
      mimeType: getMimeType(stream, parsedUrl)
    };
  }

  return {
    getPlaybackAction,
    getValidatedStreamUrl: rawUrl => parseStreamUrl(rawUrl) ? rawUrl : null
  };
});
