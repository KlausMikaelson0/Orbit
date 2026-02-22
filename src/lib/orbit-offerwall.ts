export type OrbitOfferwallProvider = "ADGATE" | "BITLABS" | "FALLBACK";
export type OrbitOfferwallCategory = "PLAY" | "WATCH" | "INSTALL" | "SURVEY";

export interface OrbitOfferwallOffer {
  id: string;
  provider: OrbitOfferwallProvider;
  title: string;
  description: string;
  category: OrbitOfferwallCategory;
  rewardStarbits: number;
  payoutUsdCents: number;
  offerUrl: string;
  thumbnailUrl: string | null;
  ctaLabel: string;
  featured: boolean;
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function toOfferwallStarbitsFromUsd(
  payoutUsd: number,
  starbitsPerUsd: number,
) {
  if (!Number.isFinite(payoutUsd) || payoutUsd <= 0) {
    return 0;
  }
  if (!Number.isFinite(starbitsPerUsd) || starbitsPerUsd <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(payoutUsd * starbitsPerUsd));
}

export function getOrbitFallbackOfferwallOffers(): OrbitOfferwallOffer[] {
  const rows: OrbitOfferwallOffer[] = [
    {
      id: "fallback-raid-shadow-legends",
      provider: "FALLBACK",
      title: "RAID: Shadow Legends",
      description: "Reach account level 10 and complete the starter campaign.",
      category: "PLAY",
      rewardStarbits: 700,
      payoutUsdCents: 95,
      offerUrl: "https://store.steampowered.com/app/2333480/RAID_Shadow_Legends/",
      thumbnailUrl:
        "https://cdn.cloudflare.steamstatic.com/steam/apps/2333480/header.jpg",
      ctaLabel: "Play and earn 700",
      featured: true,
    },
    {
      id: "fallback-world-of-tanks-blitz",
      provider: "FALLBACK",
      title: "World of Tanks Blitz",
      description: "Play 3 matches and unlock your first reward crate.",
      category: "PLAY",
      rewardStarbits: 520,
      payoutUsdCents: 74,
      offerUrl: "https://store.steampowered.com/app/444200/World_of_Tanks_Blitz/",
      thumbnailUrl:
        "https://cdn.cloudflare.steamstatic.com/steam/apps/444200/header.jpg",
      ctaLabel: "Play and earn 520",
      featured: true,
    },
    {
      id: "fallback-genshin-rank",
      provider: "FALLBACK",
      title: "Genshin Impact Starter Quest",
      description: "Reach Adventure Rank 12 and finish your first domains.",
      category: "PLAY",
      rewardStarbits: 930,
      payoutUsdCents: 122,
      offerUrl: "https://genshin.hoyoverse.com/",
      thumbnailUrl: "https://uploadstatic-sea.hoyoverse.com/contentweb/20230113/2023011317402986135.jpg",
      ctaLabel: "Play and earn 930",
      featured: true,
    },
    {
      id: "fallback-epic-demo-claim",
      provider: "FALLBACK",
      title: "Epic Games Demo Challenge",
      description: "Install and launch a featured demo from Epic Store.",
      category: "INSTALL",
      rewardStarbits: 460,
      payoutUsdCents: 68,
      offerUrl: "https://store.epicgames.com/",
      thumbnailUrl: null,
      ctaLabel: "Install and earn 460",
      featured: false,
    },
    {
      id: "fallback-youtube-trailer",
      provider: "FALLBACK",
      title: "Watch Sponsor Trailer",
      description: "Watch full sponsored trailer without skipping.",
      category: "WATCH",
      rewardStarbits: 210,
      payoutUsdCents: 32,
      offerUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: null,
      ctaLabel: "Watch and earn 210",
      featured: false,
    },
    {
      id: "fallback-browser-game-session",
      provider: "FALLBACK",
      title: "Browser Game Session",
      description: "Play a browser challenge for 10 minutes.",
      category: "PLAY",
      rewardStarbits: 380,
      payoutUsdCents: 55,
      offerUrl: "https://poki.com/",
      thumbnailUrl: null,
      ctaLabel: "Play and earn 380",
      featured: false,
    },
    {
      id: "fallback-survey-gaming",
      provider: "FALLBACK",
      title: "Gaming Survey Panel",
      description: "Complete profile survey and verification steps.",
      category: "SURVEY",
      rewardStarbits: 260,
      payoutUsdCents: 41,
      offerUrl: "https://www.cpx-research.com/main/en/doc.php",
      thumbnailUrl: null,
      ctaLabel: "Complete and earn 260",
      featured: false,
    },
  ];

  return rows
    .map((row) => ({
      ...row,
      offerUrl: normalizeUrl(row.offerUrl) ?? "https://store.steampowered.com/",
      thumbnailUrl: row.thumbnailUrl ? normalizeUrl(row.thumbnailUrl) : null,
    }))
    .sort((a, b) => b.rewardStarbits - a.rewardStarbits);
}
