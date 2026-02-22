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

const ORBIT_OFFICIAL_GIF_DEFS = [
  {
    id: "orbit-gif-bot-hello",
    title: "Orbit Bot Hello",
    url: "https://media.giphy.com/media/3oEjHCWdU7F4hkcudy/giphy.gif",
  },
  {
    id: "orbit-gif-bot-wave",
    title: "Orbit Bot Wave",
    url: "https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif",
  },
  {
    id: "orbit-gif-bot-welcome",
    title: "Orbit Bot Welcome",
    url: "https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif",
  },
  {
    id: "orbit-gif-bot-gg",
    title: "Orbit Bot GG",
    url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",
  },
  {
    id: "orbit-gif-bot-hype",
    title: "Orbit Bot Hype",
    url: "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif",
  },
  {
    id: "orbit-gif-bot-thanks",
    title: "Orbit Bot Thanks",
    url: "https://media.giphy.com/media/xUPGcl3ijl0vAEyIDK/giphy.gif",
  },
  {
    id: "orbit-gif-bot-cheer",
    title: "Orbit Bot Cheer",
    url: "https://media.giphy.com/media/l1J9EdzfOSgfyueLm/giphy.gif",
  },
  {
    id: "orbit-gif-bot-party",
    title: "Orbit Bot Party",
    url: "https://media.giphy.com/media/l4FGpP4lxGGgK5CBW/giphy.gif",
  },
  {
    id: "orbit-gif-bot-spark",
    title: "Orbit Bot Spark",
    url: "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
  },
  {
    id: "orbit-gif-bot-heart",
    title: "Orbit Bot Heart",
    url: "https://media.giphy.com/media/26ufnwz3wDUli7GU0/giphy.gif",
  },
  {
    id: "orbit-gif-bot-ready",
    title: "Orbit Bot Ready",
    url: "https://media.giphy.com/media/fAnEC88LccN7a/giphy.gif",
  },
  {
    id: "orbit-gif-bot-focus",
    title: "Orbit Bot Focus",
    url: "https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif",
  },
  {
    id: "orbit-gif-bot-launch",
    title: "Orbit Bot Launch",
    url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  },
  {
    id: "orbit-gif-bot-yes",
    title: "Orbit Bot Yes",
    url: "https://media.giphy.com/media/l2JehQ2GitHGdVG9y/giphy.gif",
  },
  {
    id: "orbit-gif-bot-nope",
    title: "Orbit Bot Nope",
    url: "https://media.giphy.com/media/3og0IPxMM0erATueVW/giphy.gif",
  },
  {
    id: "orbit-gif-bot-hand-hello",
    title: "Orbit Bot Hand Hello",
    url: "https://media.giphy.com/media/xTiTnuhyBF54B852nK/giphy.gif",
  },
  {
    id: "orbit-gif-bot-welcome-home",
    title: "Orbit Bot Welcome Home",
    url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif",
  },
  {
    id: "orbit-gif-bot-chef-kiss",
    title: "Orbit Bot Chef Kiss",
    url: "https://media.giphy.com/media/3orieTfp1MeFLiBQR2/giphy.gif",
  },
  {
    id: "orbit-gif-bot-hi-there",
    title: "Orbit Bot Hi There",
    url: "https://media.giphy.com/media/l0ExncehJzexFpRHq/giphy.gif",
  },
  {
    id: "orbit-gif-bot-big-wave",
    title: "Orbit Bot Big Wave",
    url: "https://media.giphy.com/media/3o7TKz9b8p4M73N6fC/giphy.gif",
  },
  {
    id: "orbit-gif-bot-approved",
    title: "Orbit Bot Approved",
    url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
  },
  {
    id: "orbit-gif-bot-lfg",
    title: "Orbit Bot LFG",
    url: "https://media.giphy.com/media/l2Sq5FEQNgjaCKlSE/giphy.gif",
  },
  {
    id: "orbit-gif-bot-cool",
    title: "Orbit Bot Cool",
    url: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
  },
  {
    id: "orbit-gif-bot-salute",
    title: "Orbit Bot Salute",
    url: "https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif",
  },
  {
    id: "orbit-gif-bot-legit",
    title: "Orbit Bot Legit",
    url: "https://media.giphy.com/media/xT5LMMv6B5QJ0bYyI0/giphy.gif",
  },
] as const;

export const ORBIT_OFFICIAL_GIFS: OrbitMediaPickerItem[] = ORBIT_OFFICIAL_GIF_DEFS.map(
  (item) =>
    makeMediaItem(item.id, item.title, item.url, "GIF", "ORBIT", "image/gif"),
);

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

const ORBIT_GENERAL_TRENDING_GIF_DEFS = [
  { id: "fallback-trending-01", title: "Popular Clap", url: "https://media.giphy.com/media/OkJat1YNdoD3W/giphy.gif" },
  { id: "fallback-trending-02", title: "Popular Smile", url: "https://media.giphy.com/media/l0HUpt2s9Pclgt9Vm/giphy.gif" },
  { id: "fallback-trending-03", title: "Popular Laugh", url: "https://media.giphy.com/media/l4FGuhL4U2WyjdkaY/giphy.gif" },
  { id: "fallback-trending-04", title: "Popular Wow", url: "https://media.giphy.com/media/3o6wrvdHFbwBrUFenu/giphy.gif" },
  { id: "fallback-trending-05", title: "Popular Happy", url: "https://media.giphy.com/media/l3V0dy1zzyjbYTQQM/giphy.gif" },
  { id: "fallback-trending-06", title: "Popular Dance", url: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif" },
  { id: "fallback-trending-07", title: "Popular Hello", url: "https://media.giphy.com/media/l0ExncehJzexFpRHq/giphy.gif" },
  { id: "fallback-trending-08", title: "Popular Mission", url: "https://media.giphy.com/media/3o7TKz9b8p4M73N6fC/giphy.gif" },
  { id: "fallback-trending-09", title: "Popular Good Job", url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif" },
  { id: "fallback-trending-10", title: "Popular Thanks", url: "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif" },
  { id: "fallback-trending-11", title: "Popular Hype", url: "https://media.giphy.com/media/l2Sq5FEQNgjaCKlSE/giphy.gif" },
  { id: "fallback-trending-12", title: "Popular Party", url: "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif" },
  { id: "fallback-trending-13", title: "Popular GG", url: "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif" },
  { id: "fallback-trending-14", title: "Popular Approved", url: "https://media.giphy.com/media/l0Exk8EUzSLsrErEQ/giphy.gif" },
  { id: "fallback-trending-15", title: "Popular Reaction", url: "https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif" },
  { id: "fallback-trending-16", title: "Popular Bounce", url: "https://media.giphy.com/media/3o7aCTfyhYawdOXcFW/giphy.gif" },
  { id: "fallback-trending-17", title: "Popular Chill", url: "https://media.giphy.com/media/xT9DPIlGnuHpr2yObu/giphy.gif" },
  { id: "fallback-trending-18", title: "Popular Success", url: "https://media.giphy.com/media/xT9DPpf0zTqRASyzTi/giphy.gif" },
  { id: "fallback-trending-19", title: "Popular Nice", url: "https://media.giphy.com/media/xT5LMMv6B5QJ0bYyI0/giphy.gif" },
  { id: "fallback-trending-20", title: "Popular Mood", url: "https://media.giphy.com/media/l0HlQ7LRalQqdWfao/giphy.gif" },
  { id: "fallback-trending-21", title: "Popular Fire", url: "https://media.giphy.com/media/26gssIytJvy1b1THO/giphy.gif" },
  { id: "fallback-trending-22", title: "Popular Cool", url: "https://media.giphy.com/media/l4Ep3mmmj7Bw3adWw/giphy.gif" },
  { id: "fallback-trending-23", title: "Popular Win", url: "https://media.giphy.com/media/3oEjHAUOqG3lSS0f1C/giphy.gif" },
  { id: "fallback-trending-24", title: "Popular Gaming", url: "https://media.giphy.com/media/l3q2RauzE5Vzf7iYo/giphy.gif" },
  { id: "fallback-trending-25", title: "Popular Pog", url: "https://media.giphy.com/media/l2SpXzKHRREk2mXQc/giphy.gif" },
  { id: "fallback-trending-26", title: "Popular Lets Go", url: "https://media.giphy.com/media/3o7aD4kZn5k0SEvPmo/giphy.gif" },
  { id: "fallback-trending-27", title: "Popular Weekend", url: "https://media.giphy.com/media/l1J3preURPiwjRPvG/giphy.gif" },
  { id: "fallback-trending-28", title: "Popular Weekend Mood", url: "https://media.giphy.com/media/l2SpQdJ7u7rfgED5e/giphy.gif" },
  { id: "fallback-trending-29", title: "Popular Cheers", url: "https://media.giphy.com/media/3ov9jNziFTMfzSumAw/giphy.gif" },
  { id: "fallback-trending-30", title: "Popular Yay", url: "https://media.giphy.com/media/l2SpNQ2pA5kuQ4Nfa/giphy.gif" },
  { id: "fallback-trending-31", title: "Popular Day", url: "https://media.giphy.com/media/3oEduSbSGpGaRX2Vri/giphy.gif" },
  { id: "fallback-trending-32", title: "Popular Love", url: "https://media.giphy.com/media/l0HlSNOxJB956qwfK/giphy.gif" },
  { id: "fallback-trending-33", title: "Popular Big Mood", url: "https://media.giphy.com/media/l2SpMDbxk09bYpGPC/giphy.gif" },
  { id: "fallback-trending-34", title: "Popular Good Vibes", url: "https://media.giphy.com/media/xUPGcguWZHRC2HyBRS/giphy.gif" },
  { id: "fallback-trending-35", title: "Popular Celebrate", url: "https://media.giphy.com/media/3o6fJ5LANL0x31R1Ic/giphy.gif" },
  { id: "fallback-trending-36", title: "Popular Daily", url: "https://media.giphy.com/media/l4FGJtQ9JX5E44vYk/giphy.gif" },
  { id: "fallback-trending-37", title: "Popular Reaction Loop", url: "https://media.giphy.com/media/l2JdYxdKku97fOuEo/giphy.gif" },
  { id: "fallback-trending-38", title: "Popular Snack", url: "https://media.giphy.com/media/l2Je4CVBcnZf2E1xu/giphy.gif" },
  { id: "fallback-trending-39", title: "Popular Cozy", url: "https://media.giphy.com/media/l4FGGafcOHmrlQxG0/giphy.gif" },
  { id: "fallback-trending-40", title: "Popular Nice Day", url: "https://media.giphy.com/media/l4FATJpd4LWgeruTK/giphy.gif" },
  { id: "fallback-trending-41", title: "Popular Wave", url: "https://media.giphy.com/media/l41lWsVL8GSTY8xTa/giphy.gif" },
  { id: "fallback-trending-42", title: "Popular Surprise", url: "https://media.giphy.com/media/26xBCJ7abE7ZCvyow/giphy.gif" },
  { id: "fallback-trending-43", title: "Popular Morning", url: "https://media.giphy.com/media/l0HUpt2s9Pclgt9Vm/giphy.gif" },
  { id: "fallback-trending-44", title: "Popular Weekend Energy", url: "https://media.giphy.com/media/l4FGuhL4U2WyjdkaY/giphy.gif" },
  { id: "fallback-trending-45", title: "Popular Study Mode", url: "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif" },
  { id: "fallback-trending-46", title: "Popular Good Signal", url: "https://media.giphy.com/media/l2JehQ2GitHGdVG9y/giphy.gif" },
  { id: "fallback-trending-47", title: "Popular Approved Loop", url: "https://media.giphy.com/media/3og0IPxMM0erATueVW/giphy.gif" },
  { id: "fallback-trending-48", title: "Popular Team Up", url: "https://media.giphy.com/media/l1J9EdzfOSgfyueLm/giphy.gif" },
  { id: "fallback-trending-49", title: "Popular Hug", url: "https://media.giphy.com/media/26ufnwz3wDUli7GU0/giphy.gif" },
  { id: "fallback-trending-50", title: "Popular React", url: "https://media.giphy.com/media/xT9IgIc0lryrxvqVGM/giphy.gif" },
  { id: "fallback-trending-51", title: "Popular Hand Wave", url: "https://media.giphy.com/media/xTiTnuhyBF54B852nK/giphy.gif" },
  { id: "fallback-trending-52", title: "Popular Focused", url: "https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif" },
  { id: "fallback-trending-53", title: "Popular Spark Vibes", url: "https://media.giphy.com/media/3orieTfp1MeFLiBQR2/giphy.gif" },
  { id: "fallback-trending-54", title: "Popular Reaction V2", url: "https://media.giphy.com/media/3o6wrvdHFbwBrUFenu/giphy.gif" },
  { id: "fallback-trending-55", title: "Popular Daily V2", url: "https://media.giphy.com/media/l3V0dy1zzyjbYTQQM/giphy.gif" },
  { id: "fallback-trending-56", title: "Popular Bounce V2", url: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif" },
  { id: "fallback-trending-57", title: "Popular Hi Again", url: "https://media.giphy.com/media/l0ExncehJzexFpRHq/giphy.gif" },
  { id: "fallback-trending-58", title: "Popular Wave Again", url: "https://media.giphy.com/media/3o7TKz9b8p4M73N6fC/giphy.gif" },
  { id: "fallback-trending-59", title: "Popular Nice Work", url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif" },
  { id: "fallback-trending-60", title: "Popular Motion", url: "https://media.giphy.com/media/l41lFw057lAJQMwg0/giphy.gif" },
] as const;

export const ORBIT_FALLBACK_TRENDING_GIFS: OrbitMediaPickerItem[] = [
  ...ORBIT_OFFICIAL_GIFS,
  ...ORBIT_GENERAL_TRENDING_GIF_DEFS.map((item) =>
    makeMediaItem(item.id, item.title, item.url, "GIF", "GIPHY", "image/gif"),
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
  makeMediaItem(
    "fallback-sticker-3",
    "Sticker Hello",
    "https://media.giphy.com/media/l0ExncehJzexFpRHq/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-sticker-4",
    "Sticker Wave",
    "https://media.giphy.com/media/3o7TKz9b8p4M73N6fC/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-sticker-5",
    "Sticker Hype",
    "https://media.giphy.com/media/l2Sq5FEQNgjaCKlSE/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-sticker-6",
    "Sticker Spark",
    "https://media.giphy.com/media/3oEjHCWdU7F4hkcudy/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-sticker-7",
    "Sticker Cheer",
    "https://media.giphy.com/media/26u4lOMA8JKSnL9Uk/giphy.gif",
    "STICKER",
    "GIPHY",
    "image/gif",
  ),
  makeMediaItem(
    "fallback-sticker-8",
    "Sticker Party",
    "https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif",
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
