// @remove-before-production
import React from "react";
import { isSouqFishingEnabled } from "@/modules/souq-fishing/config/feature-flag";
import { createInitialWorldState } from "@/modules/souq-fishing/engine/world";
import { ControllerShell } from "@/modules/souq-fishing/ui/controller";
import type { TeamColor, WorldState, FishTier } from "@/modules/souq-fishing/engine/types";

interface PageProps {
  searchParams?: {
    state?: string;
    team?: string;
    tier?: string;
  };
}

export default function ControllerPreviewPage({ searchParams }: PageProps) {
  // Feature flag gate
  if (!isSouqFishingEnabled()) {
    return null;
  }

  const teamParam = (searchParams?.team?.toUpperCase() || "MERAH") as TeamColor;
  const stateParam = searchParams?.state?.toLowerCase() || "pre_game";
  const tierParam = (searchParams?.tier?.toUpperCase() || "COMMON") as FishTier;

  const validTeam: TeamColor = ["MERAH", "BIRU", "KUNING", "HIJAU"].includes(teamParam)
    ? teamParam
    : "MERAH";

  const world: WorldState = createInitialWorldState();

  // Override simulated state for mobile preview
  const currentTeam = world.teams[validTeam];
  if (stateParam === "pre_game") {
    (currentTeam as unknown as { status: string }).status = "PRE_GAME";
  } else if (stateParam === "walking") {
    currentTeam.status = "TRAVELING";
    currentTeam.location = "KIOS";
  } else if (stateParam === "gate") {
    currentTeam.status = "IN_GATE_QUESTION";
    currentTeam.location = "KIOS";
    currentTeam.pinsUnlocked = 1;
  } else if (stateParam === "fishing") {
    currentTeam.status = "IN_FISHING_QUESTION";
    currentTeam.location = "DERMAGA_1";
    currentTeam.currentQuestion = {
      tier: tierParam,
      targetPoints: tierParam === "RARE" ? 250 : tierParam === "EPIC" ? 500 : tierParam === "LEGENDARY" ? 1000 : 75,
      timerUntilMs: tierParam === "RARE" ? 20000 : null,
    };
  } else if (stateParam === "assisted") {
    currentTeam.status = "ASSISTED_WAITING";
    currentTeam.consecutiveWrong = 3;
    currentTeam.restUntilMs = 15000;
  } else if (stateParam === "queued") {
    currentTeam.status = "QUEUED_QUESTION";
    currentTeam.location = "KIOS";
  }

  return (
    <div className="w-full min-h-screen bg-slate-900 py-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm h-screen bg-slate-950 shadow-2xl border-x border-slate-800 overflow-hidden">
        <ControllerShell worldState={world} currentTeamColor={validTeam} />
      </div>
    </div>
  );
}
