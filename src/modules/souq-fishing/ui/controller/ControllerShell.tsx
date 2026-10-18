import React from "react";
import type { WorldState, TeamColor } from "../../engine/types";
import { PreGameDashboard } from "./PreGameDashboard";
import { WalkingView } from "./WalkingView";
import { GateQuestionView } from "./GateQuestionView";
import { FishingQuestionView } from "./FishingQuestionView";
import { AssistedRestView } from "./AssistedRestView";

export interface ControllerShellProps {
  worldState: WorldState;
  currentTeamColor: TeamColor;
  onAction?: (action: string, payload?: unknown) => void;
}

export function ControllerShell({
  worldState,
  currentTeamColor,
  onAction,
}: ControllerShellProps) {
  const team = worldState.teams[currentTeamColor];

  if (!team) {
    return (
      <div
        className="flex items-center justify-center h-full w-full p-4 bg-slate-950 text-slate-400 text-sm"
        data-testid="controller-no-team"
      >
        Tim tidak ditemukan ({currentTeamColor}).
      </div>
    );
  }

  const isPreGame = (team.status as string) === "PRE_GAME";

  // Pure 4-State Switcher: Exactly 1 state mounted at any given time
  return (
    <main
      className="controller-shell flex flex-col h-screen w-full overflow-hidden bg-slate-950"
      data-testid="controller-shell"
    >
      {isPreGame && <PreGameDashboard team={team} onAction={onAction} />}

      {!isPreGame &&
        (team.status === "TRAVELING" ||
          team.status === "IDLE_AT_GATE" ||
          team.status === "FISHING_WAITING" ||
          team.status === "QUEUED_QUESTION") && (
          <WalkingView team={team} onAction={onAction} />
        )}

      {!isPreGame && team.status === "IN_GATE_QUESTION" && (
        <GateQuestionView
          team={team}
          onSelectOption={(optionId) =>
            onAction?.("submitGateAnswer", { optionId })
          }
        />
      )}

      {!isPreGame && team.status === "IN_FISHING_QUESTION" && (
        <FishingQuestionView
          team={team}
          onAction={onAction}
          onSelectOption={(optionId) =>
            onAction?.("submitFishingAnswer", { optionId })
          }
        />
      )}

      {!isPreGame && team.status === "ASSISTED_WAITING" && (
        <AssistedRestView
          team={team}
          onContinue={() => onAction?.("finishAssistedRest")}
        />
      )}
    </main>
  );
}
