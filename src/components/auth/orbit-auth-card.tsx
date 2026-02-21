"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Orbit, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrbitLanguagePicker } from "@/src/components/i18n/orbit-language-picker";
import { useOrbitLocale } from "@/src/hooks/use-orbit-locale";
import { getOrbitSupabaseClient, isSupabaseReady } from "@/src/lib/supabase-browser";

type OrbitAuthMode = "signin" | "signup";

function normalizePublicUrl(rawValue: string | undefined) {
  const value = rawValue?.trim();
  if (!value) {
    return null;
  }

  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(normalized).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveOAuthRedirectBase() {
  const explicitAuthBase = normalizePublicUrl(process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL);
  if (explicitAuthBase) {
    return explicitAuthBase;
  }

  const appBase = normalizePublicUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (appBase) {
    return appBase;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export function OrbitAuthCard() {
  const supabase = useMemo(() => getOrbitSupabaseClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useOrbitLocale();
  const [mode, setMode] = useState<OrbitAuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseReady()) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard?local=0");
      }
    });
  }, [router, supabase]);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (!oauthError) {
      return;
    }

    setError(oauthError);
    setMessage(null);
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseReady()) {
      setError(t("auth.notConfigured"));
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(t("auth.emailPasswordRequired"));
      setLoading(false);
      return;
    }

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.replace("/dashboard?local=0");
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: name.trim() || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setMessage(t("auth.accountCreated"));
    setMode("signin");
    setLoading(false);
  }

  async function handleGoogle() {
    if (!isSupabaseReady()) {
      setError(t("auth.notConfigured"));
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const oauthRedirectBase = resolveOAuthRedirectBase();
    const redirectTo = `${oauthRedirectBase}/auth/callback?next=${encodeURIComponent("/dashboard?local=0")}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (oauthError) {
      setError(`${oauthError.message} ${t("auth.oauthSetupHelp")}`);
      setLoading(false);
    }
  }

  const title = mode === "signin" ? t("auth.welcomeBack") : t("auth.createIdentity");
  const subtitle =
    mode === "signin"
      ? t("auth.subtitleSignin")
      : t("auth.subtitleSignup");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070b] px-4 py-12 text-white">
      <motion.div
        animate={{ y: [0, -25, 0], opacity: [0.25, 0.45, 0.25] }}
        className="orb-blur absolute -left-20 top-0 h-80 w-80 bg-violet-500/30"
        transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY }}
      />
      <motion.div
        animate={{ x: [0, 24, 0], scale: [1, 1.08, 1] }}
        className="orb-blur absolute -right-16 bottom-0 h-96 w-96 bg-fuchsia-500/20"
        transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY }}
      />
      <div className="cosmic-grid absolute inset-0 opacity-30" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-panel rounded-3xl p-8">
          <div className="mb-8 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-500/20 p-3 text-violet-200">
                <Orbit className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xl font-semibold">{t("auth.orbitAuth")}</p>
                <p className="text-sm text-zinc-400">{t("auth.secureFastRealtime")}</p>
              </div>
            </div>
            <OrbitLanguagePicker compact showLabel={false} />
          </div>

          <h1 className="mb-2 text-3xl font-semibold">{title}</h1>
          <p className="mb-8 text-zinc-300">{subtitle}</p>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <Input
                className="h-11 rounded-xl bg-black/30"
                onChange={(event) => setName(event.target.value)}
                placeholder={t("auth.namePlaceholder")}
                value={name}
              />
            ) : null}
            <Input
              className="h-11 rounded-xl bg-black/30"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              type="email"
              value={email}
            />
            <Input
              className="h-11 rounded-xl bg-black/30"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              type="password"
              value={password}
            />
            <Button className="h-11 w-full rounded-xl text-sm" disabled={loading} type="submit">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signin" ? t("auth.signInButton") : t("auth.createButton")}
            </Button>
          </form>

          <Button
            className="mt-3 h-11 w-full rounded-xl border-violet-400/30 bg-transparent hover:bg-violet-500/10"
            disabled={loading}
            onClick={handleGoogle}
            variant="outline"
          >
            {t("auth.googleButton")}
          </Button>

          <button
            className="mt-5 text-sm text-violet-200 hover:text-violet-100"
            disabled={loading}
            onClick={() => {
              setMode((current) => (current === "signin" ? "signup" : "signin"));
              setError(null);
              setMessage(null);
            }}
            type="button"
          >
            {mode === "signin"
              ? t("auth.needAccount")
              : t("auth.haveAccount")}
          </button>

          {message ? (
            <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-100">
              {!isSupabaseReady()
                ? "Cloud auth is not configured yet. You can continue now in browser local mode."
                : "Need immediate access? Continue in browser local mode as guest."}
            </p>
            <Button asChild className="mt-2 rounded-full" size="sm" variant="secondary">
              <Link href="/dashboard?local=1">Continue in browser</Link>
            </Button>
          </div>
        </div>

        <div className="glass-panel flex flex-col justify-between rounded-3xl p-8">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs text-violet-200">
              <Sparkles className="h-3.5 w-3.5" />
              {t("auth.identityLayer")}
            </div>
            <h2 className="mb-3 text-2xl font-semibold">{t("auth.missionTitle")}</h2>
            <p className="text-sm leading-relaxed text-zinc-300">
              {t("auth.missionDescription")}
            </p>
          </div>
          <div className="mt-8 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-zinc-400">{t("auth.sessionContinuity")}</p>
              <p className="text-lg font-semibold text-violet-200">{t("auth.crossTabSynced")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs text-zinc-400">{t("auth.oauthReadiness")}</p>
              <p className="text-lg font-semibold text-violet-200">{t("auth.googleEnabled")}</p>
            </div>
            <Button asChild className="w-full rounded-xl" variant="ghost">
              <Link href="/">{t("auth.backHome")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
