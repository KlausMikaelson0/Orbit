"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Lock,
  Orbit,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { OrbitLanguagePicker } from "@/src/components/i18n/orbit-language-picker";
import { useOrbitLocale } from "@/src/hooks/use-orbit-locale";

type DownloadTarget = {
  label: string;
  href: string;
};

const DOWNLOAD_TARGETS: Record<"windows" | "mac" | "linux", DownloadTarget> = {
  windows: {
    label: "Windows",
    href: "https://github.com/KlausMikaelson0/orbit/releases/download/v1.0.2/orbit-desktop-windows-latest.zip",
  },
  mac: {
    label: "macOS",
    href: "https://github.com/KlausMikaelson0/orbit/releases/download/v1.0.2/orbit-desktop-macos-latest.zip",
  },
  linux: {
    label: "Linux",
    href: "https://github.com/KlausMikaelson0/orbit/releases/download/v1.0.2/orbit-desktop-ubuntu-latest.zip",
  },
};

function detectDesktopTarget() {
  if (typeof navigator === "undefined") {
    return DOWNLOAD_TARGETS.windows;
  }
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (ua.includes("mac") || platform.includes("mac")) {
    return DOWNLOAD_TARGETS.mac;
  }
  if (ua.includes("linux") || platform.includes("linux")) {
    return DOWNLOAD_TARGETS.linux;
  }
  return DOWNLOAD_TARGETS.windows;
}

const whyOrbitCards = [
  {
    titleKey: "landing.speedTitle" as const,
    descriptionKey: "landing.speedDesc" as const,
    icon: Zap,
  },
  {
    titleKey: "landing.privacyTitle" as const,
    descriptionKey: "landing.privacyDesc" as const,
    icon: Lock,
  },
  {
    titleKey: "landing.aiTitle" as const,
    descriptionKey: "landing.aiDesc" as const,
    icon: BrainCircuit,
  },
];

const orbitSteps = [
  {
    titleKey: "landing.step1Title" as const,
    descriptionKey: "landing.step1Desc" as const,
  },
  {
    titleKey: "landing.step2Title" as const,
    descriptionKey: "landing.step2Desc" as const,
  },
  {
    titleKey: "landing.step3Title" as const,
    descriptionKey: "landing.step3Desc" as const,
  },
];

export function OrbitLandingPage() {
  const { t } = useOrbitLocale();
  const browserOpenHref = "/dashboard?local=1";
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget>(
    DOWNLOAD_TARGETS.windows,
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 46 }).map((_, index) => ({
        id: index,
        left: `${(index * 13.7) % 100}%`,
        top: `${(index * 19.3) % 100}%`,
        size: 1 + ((index * 7) % 3),
        duration: 8 + (index % 6),
        delay: (index % 9) * 0.35,
      })),
    [],
  );

  useEffect(() => {
    setDownloadTarget(detectDesktopTarget());
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none absolute inset-0">
        {stars.map((star) => (
          <motion.span
            animate={{ opacity: [0.2, 0.85, 0.2], y: [0, -10, 0] }}
            className="absolute rounded-full bg-cyan-200/80"
            key={star.id}
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
            }}
            transition={{
              duration: star.duration,
              repeat: Number.POSITIVE_INFINITY,
              delay: star.delay,
              ease: "easeInOut",
            }}
          />
        ))}
        <motion.div
          animate={{ rotate: 360 }}
          className="absolute left-1/2 top-[22%] h-[540px] w-[540px] -translate-x-1/2 rounded-full border border-violet-400/15"
          transition={{ duration: 72, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          className="absolute left-1/2 top-[22%] h-[390px] w-[390px] -translate-x-1/2 rounded-full border border-cyan-400/10"
          transition={{ duration: 48, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-5 md:px-8 lg:px-10">
        <header className="mb-14 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur">
          <Link className="flex items-center gap-2" href="/">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
              <Orbit className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-violet-100">Orbit</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
            <a className="transition hover:text-white" href="#features">
              {t("landing.features")}
            </a>
            <a className="transition hover:text-white" href="#about">
              {t("landing.about")}
            </a>
            <a className="transition hover:text-white" href="#safety">
              {t("landing.safety")}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <OrbitLanguagePicker compact showLabel={false} />
            <a
              className="hidden rounded-full px-3 py-2 text-xs text-zinc-300 transition hover:text-white md:inline-flex"
              href={downloadTarget.href}
              rel="noreferrer"
              target="_blank"
            >
              {t("landing.download")}
            </a>
            <Button asChild className="rounded-full" size="sm" variant="ghost">
              <Link href="/auth">{t("landing.login")}</Link>
            </Button>
            <Button asChild className="rounded-full px-4" size="sm">
              <Link href={browserOpenHref}>{t("landing.openBrowser")}</Link>
            </Button>
          </div>
        </header>

        <section className="mb-24 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing.badge")}
            </div>
            <h1 className="mb-5 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mb-8 max-w-2xl text-base text-zinc-300 sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 px-6 text-sm font-semibold text-white shadow-[0_0_40px_rgba(124,58,237,0.45)] transition hover:scale-[1.01]"
                href={downloadTarget.href}
                rel="noreferrer"
                target="_blank"
              >
                {t("landing.downloadFor", { label: downloadTarget.label })}
                <ArrowRight className="h-4 w-4" />
              </a>
              <Button
                asChild
                className="h-12 rounded-full border border-white/15 bg-white/[0.04] px-6 text-sm text-zinc-100 hover:bg-white/[0.08]"
                variant="ghost"
              >
                <Link href={browserOpenHref}>{t("landing.openInBrowser")}</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur">
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-zinc-400">
              {t("landing.runtime")}
            </p>
            <div className="grid gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">{t("landing.realtimeLatency")}</p>
                <p className="mt-1 text-3xl font-semibold text-violet-200">&lt; 200ms</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">{t("landing.desktopWebParity")}</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-200">
                  {t("landing.oneEcosystem")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">{t("landing.aiRails")}</p>
                <p className="mt-1 text-2xl font-semibold text-fuchsia-200">
                  {t("landing.builtInByDefault")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-20" id="features">
          <h2 className="mb-2 text-3xl font-semibold">{t("landing.whyTitle")}</h2>
          <p className="mb-6 text-zinc-300">
            {t("landing.whySubtitle")}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {whyOrbitCards.map((card) => (
              <article
                className="rounded-2xl border border-white/10 bg-black/25 p-5"
                key={card.titleKey}
              >
                <div className="mb-3 inline-flex rounded-xl bg-violet-500/15 p-2.5 text-violet-200">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t(card.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {t(card.descriptionKey)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20">
          <h2 className="mb-2 text-3xl font-semibold">{t("landing.howTitle")}</h2>
          <p className="mb-6 text-zinc-300">
            {t("landing.howSubtitle")}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {orbitSteps.map((step, index) => (
              <article
                className="rounded-2xl border border-white/10 bg-black/25 p-5"
                key={step.titleKey}
              >
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t(step.titleKey)}</h3>
                <p className="text-sm leading-relaxed text-zinc-300">
                  {t(step.descriptionKey)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20" id="safety">
          <h2 className="mb-2 text-3xl font-semibold">{t("landing.safetyTitle")}</h2>
          <p className="mb-6 text-zinc-300">
            {t("landing.safetySubtitle")}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <div className="mb-3 inline-flex rounded-xl bg-emerald-500/20 p-2.5 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("landing.platformSecurityTitle")}
              </h3>
              <p className="text-sm text-zinc-300">
                {t("landing.platformSecurityDesc")}
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <div className="mb-3 inline-flex rounded-xl bg-violet-500/20 p-2.5 text-violet-200">
                <Users2 className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                {t("landing.communityIntegrityTitle")}
              </h3>
              <p className="text-sm text-zinc-300">
                {t("landing.communityIntegrityDesc")}
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-7" id="about">
          <div className="mb-3 inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
            {t("landing.aboutBadge")}
          </div>
          <h2 className="mb-3 text-3xl font-semibold">{t("landing.aboutTitle")}</h2>
          <p className="max-w-4xl text-sm leading-relaxed text-zinc-300 sm:text-base">
            {t("landing.aboutDesc")}
          </p>
        </section>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          <p className="text-zinc-400">{t("landing.footerCopy")}</p>
          <div className="flex items-center gap-3 text-zinc-300">
            <span className="text-zinc-500">{t("landing.footerPolicyTitle")}</span>
            <Link className="transition hover:text-white" href="/terms">
              {t("landing.termsLink")}
            </Link>
            <Link className="transition hover:text-white" href="/privacy">
              {t("landing.privacyLink")}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
