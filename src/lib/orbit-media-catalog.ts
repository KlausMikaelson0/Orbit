export type OrbitMediaKind = "GIF" | "STICKER";
export type OrbitMediaSource = "GIPHY" | "ORBIT" | "SERVER";

export interface OrbitMediaPickerItem {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  kind: OrbitMediaKind;
  source: OrbitMediaSource;
}

function makeMediaItem(
  id: string,
  title: string,
  url: string,
  kind: OrbitMediaKind,
  source: OrbitMediaSource,
  mimeType: string,
): OrbitMediaPickerItem {
  return {
    id,
    title,
    url,
    preview_url: url,
    width: null,
    height: null,
    mime_type: mimeType,
    kind,
    source,
  };
}

export const ORBIT_OFFICIAL_GIFS: OrbitMediaPickerItem[] = [
  makeMediaItem(
    "orbit-gif-launch",
    "Orbit Launch",
    "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    "GIF",
    "ORBIT",
    "image/gif",
  ),
  makeMediaItem(
    "orbit-gif-wave",
    "Orbit Wave",
    "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
    "GIF",
    "ORBIT",
    "image/gif",
  ),
  makeMediaItem(
    "orbit-gif-neon",
    "Orbit Neon",
    "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
    "GIF",
    "ORBIT",
    "image/gif",
  ),
  makeMediaItem(
    "orbit-gif-spark",
    "Orbit Spark",
    "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
    "GIF",
    "ORBIT",
    "image/gif",
  ),
  makeMediaItem(
    "orbit-gif-ready",
    "Orbit Ready",
    "https://media.giphy.com/media/fAnEC88LccN7a/giphy.gif",
    "GIF",
    "ORBIT",
    "image/gif",
  ),
  makeMediaItem(
    "orbit-gif-focus",
    "Orbit Focus",
    "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",
    "GIF",
    "ORBIT",
    "image/gif",
  ),
];

export const ORBIT_OFFICIAL_STICKERS: OrbitMediaPickerItem[] = [
  makeMediaItem(
    "orbit-sticker-core",
    "Orbit Core",
    "/stickers/orbit-core.svg",
    "STICKER",
    "ORBIT",
    "image/svg+xml",
  ),
  makeMediaItem(
    "orbit-sticker-rocket",
    "Orbit Rocket",
    "/stickers/orbit-rocket.svg",
    "STICKER",
    "ORBIT",
    "image/svg+xml",
  ),
  makeMediaItem(
    "orbit-sticker-shield",
    "Orbit Shield",
    "/stickers/orbit-shield.svg",
    "STICKER",
    "ORBIT",
    "image/svg+xml",
  ),
  makeMediaItem(
    "orbit-sticker-wave",
    "Orbit Wave",
    "/stickers/orbit-wave.svg",
    "STICKER",
    "ORBIT",
    "image/svg+xml",
  ),
  makeMediaItem(
    "orbit-sticker-icon",
    "Orbit Icon",
    "/orbit-icon-192.png",
    "STICKER",
    "ORBIT",
    "image/png",
  ),
];

export const ORBIT_FALLBACK_TRENDING_GIFS: OrbitMediaPickerItem[] = [
  ...ORBIT_OFFICIAL_GIFS,
  makeMediaItem(
    "fallback-trending-1",
    "Trending Clap",
    "https://media.giphy.com/media/OkJat1YNdoD3W/giphy.gif",
    "GIF",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-trending-2",
    "Trending Hype",
    "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",
    "GIF",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-trending-3",
    "Trending Party",
    "https://media.giphy.com/media/l4FGpP4lxGGgK5CBW/giphy.gif",
    "GIF",
    "GIPHY",
    "image/gif",
  ),
];

export const ORBIT_FALLBACK_TRENDING_STICKERS: OrbitMediaPickerItem[] = [
  ...ORBIT_OFFICIAL_STICKERS,
  makeMediaItem(
    "fallback-sticker-1",
    "Sticker Spark",
    "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-sticker-2",
    "Sticker Party",
    "https://media.giphy.com/media/XD9o33QG9BoMis7iM4/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
];

export function filterOrbitMediaItems(
  items: OrbitMediaPickerItem[],
  query: string,
): OrbitMediaPickerItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.id.toLowerCase().includes(normalized),
  );
}

export function dedupeOrbitMediaItems(
  items: OrbitMediaPickerItem[],
): OrbitMediaPickerItem[] {
  const seen = new Set<string>();
  const deduped: OrbitMediaPickerItem[] = [];
  for (const item of items) {
    const key = `${item.source}:${item.id}:${item.kind}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}
