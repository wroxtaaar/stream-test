const assert = require('node:assert/strict');
const { getPlaybackAction, getValidatedStreamUrl } = require('../views/playerLaunch');

const android = 'Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile';

function test(name, callback) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('builds an MX Player intent for the selected movie stream URL', () => {
  const stream = {
    type: 'url',
    url: 'https://media.example/movie.mp4',
    name: 'Movie mirror'
  };
  const action = getPlaybackAction(stream, android);

  assert.equal(action.kind, 'mx-player');
  assert.match(action.intentUrl, /^intent:\/\/media\.example\/movie\.mp4#Intent;/);
  assert.match(action.intentUrl, /action=android\.intent\.action\.VIEW;/);
  assert.match(action.intentUrl, /category=android\.intent\.category\.BROWSABLE;/);
  assert.match(action.intentUrl, /scheme=https;package=com\.mxtech\.videoplayer\.ad;/);
  assert.match(action.intentUrl, /type=video\/mp4;/);
  assert.doesNotMatch(action.intentUrl, /browser_fallback_url/);
  assert.doesNotMatch(action.intentUrl, /\/stream\/movie\.json/);
});

test('preserves signed query values and encoded path characters', () => {
  const url = 'https://cdn.example/path%20with%2Fencoded?token=a%2Bb%26c%3D%2F&expires=123';
  const action = getPlaybackAction({ url }, android);

  assert.match(action.intentUrl, /path%20with%2Fencoded\?token=a%2Bb%26c%3D%2F&expires=123/);
  assert.doesNotMatch(action.intentUrl, /browser_fallback_url/);
});

test('does not assume an MP4 MIME type when stream type is unknown', () => {
  const action = getPlaybackAction({ url: 'https://cdn.example/watch?id=42' }, android);
  assert.equal(action.mimeType, null);
  assert.doesNotMatch(action.intentUrl, /type=/);
});

test('uses a supplied MIME type when it is a valid media MIME', () => {
  const action = getPlaybackAction({
    mimeType: 'application/vnd.apple.mpegurl',
    url: 'https://cdn.example/live'
  }, android);
  assert.equal(action.mimeType, 'application/vnd.apple.mpegurl');
  assert.match(action.intentUrl, /type=application\/vnd\.apple\.mpegurl;/);
});

test('builds an intent for the selected episode stream without changing its URL', () => {
  const streams = [
    { url: 'https://api.example/stream/series/42/2/7.json' },
    { type: 'url', url: 'https://episode.example/s02e07.mkv' }
  ];
  const action = getPlaybackAction(streams[1], android);

  assert.equal(action.kind, 'mx-player');
  assert.match(action.intentUrl, /^intent:\/\/episode\.example\/s02e07\.mkv#Intent;/);
  assert.doesNotMatch(action.intentUrl, /api\.example/);
});

test('returns a browser action on non-Android devices', () => {
  const url = 'https://cdn.example/video?sig=a%2Fb';
  assert.deepEqual(getPlaybackAction({ url }, 'Mozilla/5.0 (Windows NT 10.0)'), {
    kind: 'browser',
    url
  });
});

test('returns a direct browser fallback when required request headers are present', () => {
  const url = 'https://cdn.example/video';
  assert.deepEqual(getPlaybackAction({
    url,
    behaviorHints: { proxyHeaders: { request: { Referer: 'https://provider.example/' } } }
  }, android), {
    kind: 'headers-required',
    url
  });
});

test('rejects missing, malformed, credential-bearing, and unsupported-scheme URLs', () => {
  for (const url of [undefined, '', 'not a URL', 'javascript:alert(1)', 'ftp://cdn.example/video',
    'https://user:password@cdn.example/video']) {
    assert.equal(getPlaybackAction({ url }, android).kind, 'invalid');
    assert.equal(getValidatedStreamUrl(url), null);
  }
});

test('validates HTTP and HTTPS stream URLs for existing browser actions', () => {
  assert.equal(getValidatedStreamUrl('http://media.example/video'), 'http://media.example/video');
  assert.equal(getValidatedStreamUrl('https://media.example/video'), 'https://media.example/video');
});

console.log('All 9 MX Player launch tests passed.');
