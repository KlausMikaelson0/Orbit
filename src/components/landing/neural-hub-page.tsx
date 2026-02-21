"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  Layers3,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const corePillars = [
  {
    title: "Unified Spaces",
    description:
      "Replace isolated servers with adaptive collaboration spaces built for product, growth, and operations.",
    icon: Layers3,
  },
  {
    title: "AI-Ready by Design",
    description:
      "Orbit ships with structured context layers so AI copilots can assist without hallucinating your workspace state.",
    icon: BrainCircuit,
  },
  {
    title: "Blazing Real-Time Core",
    description:
      "Supabase-powered synchronization with sub-second updates and zero-clutter interface ergonomics.",
    icon: Zap,
  },
];

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export function NeuralHubPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070b] text-white">
      <motion.div
        animate={{ scale: [1, 1.15, 1], rotate: [0, 12, 0] }}
        className="orb-blur absolute -left-20 -top-20 h-80 w-80 bg-violet-500/35"
        transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY }}
      />
      <motion.div
        animate={{ scale: [1.05, 1, 1.08], x: [0, -24, 0] }}
        className="orb-blur absolute -right-24 top-10 h-96 w-96 bg-fuchsia-500/25"
        transition={{ duration: 18, repeat: Number.POSITIVE_INFINITY }}
      />
      <motion.div
        animate={{ y: [0, -18, 0], opacity: [0.45, 0.7, 0.45] }}
        className="orb-blur absolute bottom-0 left-1/3 h-72 w-72 bg-indigo-500/25"
        transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY }}
      />

      <div className="cosmic-grid absolute inset-0 opacity-30" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-20 pt-8 md:px-10">
        <motion.header
          animate="visible"
          initial="hidden"
          variants={reveal}
          className="glass-panel mb-14 flex items-center justify-between rounded-3xl px-5 py-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Orbit</p>
              <p className="text-xs text-zinc-400">The Evolution of Communication</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild className="rounded-full px-4" variant="ghost">
              <Link href="/auth">Orbit Auth</Link>
            </Button>
            <Button asChild className="rounded-full px-4">
              <Link href="/dashboard?local=1">
                Launch Orbit
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.header>

        <section className="mb-16 grid gap-10 lg:grid-cols-[1.25fr_0.9fr]">
          <motion.div
            animate="visible"
            className="space-y-6"
            initial="hidden"
            transition={{ staggerChildren: 0.07 }}
            variants={reveal}
          >
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-xs text-violet-200"
              variants={reveal}
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Neural Hub · Phase 1 Foundation
            </motion.div>
            <motion.h1
              className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl"
              variants={reveal}
            >
              Collaboration, reimagined for teams that move at orbital velocity.
            </motion.h1>
            <motion.p
              className="max-w-2xl text-base text-zinc-300 sm:text-lg"
              variants={reveal}
            >
              Orbit blends cosmic-grade speed, minimalist signal density, and
              AI-native architecture to replace chat clutter with focused momentum.
            </motion.p>
            <motion.div className="flex flex-wrap items-center gap-3" variants={reveal}>
              <Button asChild className="rounded-full px-6 py-6 text-base">
                <Link href="/dashboard?local=1">
                  Enter Unified Spaces
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                className="rounded-full border-violet-400/40 bg-transparent px-6 py-6 text-base hover:bg-violet-500/10"
                variant="outline"
              >
                <Link href="/auth">Create your Orbit identity</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            animate="visible"
            initial="hidden"
            variants={reveal}
            className="glass-panel neon-ring rounded-3xl p-6 sm:p-8"
          >
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
              Live Platform Snapshot
            </p>
            <p className="mb-6 text-2xl font-semibold">Orbit Control Core</p>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-zinc-400">Realtime delivery</p>
                <p className="mt-1 text-3xl font-semibold text-violet-200">&lt; 220ms</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-zinc-400">Context modules synced</p>
                <p className="mt-1 text-3xl font-semibold text-violet-200">32,984</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-zinc-400">AI-ready threads indexed</p>
                <p className="mt-1 text-3xl font-semibold text-violet-200">98.7%</p>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {corePillars.map((pillar, index) => (
            <motion.article
              animate="visible"
              className="glass-panel rounded-3xl p-6"
              initial="hidden"
              key={pillar.title}
              transition={{ delay: 0.12 * index }}
              variants={reveal}
            >
              <div className="mb-4 inline-flex rounded-xl bg-violet-500/15 p-2.5 text-violet-200">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{pillar.title}</h3>
              <p className="text-sm text-zinc-300">{pillar.description}</p>
            </motion.article>
          ))}
        </section>
      </div>
    </div>
  );
}
