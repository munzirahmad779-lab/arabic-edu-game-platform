// @remove-before-production
import React from "react";
import { isSouqFishingEnabled } from "@/modules/souq-fishing/config/feature-flag";
import { createInitialWorldState } from "@/modules/souq-fishing/engine/world";
import { hookFish } from "@/modules/souq-fishing/engine/fishing";
import { SequenceRng } from "@/modules/souq-fishing/engine/rng";
import { ProjectorShell } from "@/modules/souq-fishing/ui/projector";
import type { WorldState } from "@/modules/souq-fishing/engine/types";

interface PageProps {
  searchParams?: {
    N?: string;
    status?: string;
  };
}

export default function SouqFishingPreviewPage({ searchParams }: PageProps) {
  // Feature flag guard: render nothing if feature is disabled
  if (!isSouqFishingEnabled()) {
    return null;
  }

  const nParam = parseInt(searchParams?.N ?? "0", 10);
  const statusParam = searchParams?.status?.toLowerCase();

  let world: WorldState = createInitialWorldState();

  // Simulate status parameter override if specified
  if (statusParam === "traveling") {
    world.teams.MERAH.status = "TRAVELING";
    world.teams.MERAH.location = "KIOS";
  } else if (statusParam === "assisted") {
    world.teams.MERAH.status = "ASSISTED_WAITING";
    world.teams.MERAH.restUntilMs = 15000;
  } else if (statusParam === "queued") {
    world.teams.MERAH.status = "QUEUED_QUESTION";
  } else if (statusParam === "gate") {
    world.teams.MERAH.status = "IN_GATE_QUESTION";
    world.teams.MERAH.location = "KIOS";
  } else if (statusParam === "fishing") {
    world.teams.BIRU.zone = "DERMAGA";
    world.teams.BIRU.location = "DERMAGA_1";
    world = hookFish(world, "BIRU", "COMMON", new SequenceRng([0.5]), 1000).world;
  }

  // Simulate N (0..4) active teams in challenges
  if (nParam >= 1) {
    world.teams.MERAH.status = "IN_GATE_QUESTION";
    world.teams.MERAH.location = "KIOS";
  }
  if (nParam >= 2) {
    world.teams.BIRU.zone = "DERMAGA";
    world.teams.BIRU.location = "DERMAGA_1";
    world = hookFish(world, "BIRU", "RARE", new SequenceRng([0.5]), 2000).world;
  }
  if (nParam >= 3) {
    world.teams.KUNING.status = "IN_GATE_QUESTION";
    world.teams.KUNING.location = "GERBANG_KANTIN";
    world.teams.KUNING.pinsUnlocked = 3;
    world.teams.HIJAU.status = "QUEUED_QUESTION";
  }
  if (nParam >= 4) {
    world.teams.HIJAU.zone = "DERMAGA";
    world.teams.HIJAU.location = "DERMAGA_VIP";
    world = hookFish(world, "HIJAU", "EPIC", new SequenceRng([0.9]), 3000).world;
  }

  return <ProjectorShell worldState={world} />;
}
