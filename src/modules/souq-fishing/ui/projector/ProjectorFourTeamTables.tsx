import React from "react";
import type { WorldState, TeamColor } from "../../engine/types";
import { ALL_TEAM_COLORS } from "../../engine/world";
import { computeActiveTilt } from "../../engine/active-tilt";
import { TeamBox } from "./TeamBox";

export interface ProjectorFourTeamTablesProps {
  worldState: WorldState;
}

export function ProjectorFourTeamTables({
  worldState,
}: ProjectorFourTeamTablesProps) {
  // Delegate active tilt computation entirely to pure engine
  const { widths } = computeActiveTilt(worldState);

  return (
    <section
      className="projector-four-team-tables flex flex-row h-full w-full overflow-hidden contain-content bg-slate-950/90"
      data-testid="projector-four-team-tables"
    >
      {ALL_TEAM_COLORS.map((color: TeamColor, idx: number) => {
        const team = worldState.teams[color];
        const widthPercent = widths[idx];

        return (
          <TeamBox
            key={color}
            team={team}
            widthPercent={widthPercent}
          />
        );
      })}
    </section>
  );
}
