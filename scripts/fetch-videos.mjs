import fs from 'node:fs/promises';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const streamHost = (process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

function getUrls(uid) {
  return {
    watch: `https://${streamHost}/${uid}/watch`,
    iframe: `https://${streamHost}/${uid}/iframe`,
    thumbnail: `https://${streamHost}/${uid}/thumbnails/thumbnail.jpg?time=1s&height=360`
  };
}

async function fetchAllVideos() {
  if (!accountId || !apiToken || !streamHost) {
    console.warn('Cloudflare secrets are missing. Keeping placeholder videos.json.');
    return [];
  }

  const videos = [];
  let page = 1;
  while (page <= 10) {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });
    const payload = await response.json();
    if (!response.ok || payload.success === false) {
      throw new Error(payload.errors?.[0]?.message || `Cloudflare Stream request failed: ${response.status}`);
    }

    const batch = Array.isArray(payload.result) ? payload.result : [];
    videos.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return videos;
}

const cloudflareVideos = await fetchAllVideos();
const videos = cloudflareVideos
  .filter((video) => video.uid)
  .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
  .map((video) => ({
    uid: video.uid,
    title: video.meta?.name || video.filename || 'Grabacion LoomLocal',
    created: video.created || video.uploaded || '',
    duration: Number(video.duration || 0),
    size: Number(video.size || 0),
    readyToStream: Boolean(video.readyToStream),
    ...getUrls(video.uid)
  }));

await fs.writeFile('videos.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  videos
}, null, 2));
