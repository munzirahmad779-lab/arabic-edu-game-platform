import React from "react";
import type { WorldState } from "../../engine/types";
import { ProjectorWorldMap } from "./ProjectorWorldMap";
import { ProjectorFourTeamTables } from "./ProjectorFourTeamTables";

export interface ProjectorShellProps {
  worldState: WorldState;
}

/**
 * Projector Root Shell Layout (100vh).
 * Strictly partitioned into grid-rows-[58fr_42fr]:
 * - Top Row (58vh): ProjectorWorldMap (50/50 horizontal split between Pasar and Dermaga)
 * - Bottom Row (42vh): ProjectorFourTeamTables (Active Tilt flex row for 4 teams)
 */
export function ProjectorShell({ worldState }: ProjectorShellProps) {
  return (
    <main
      className="projector-shell h-screen w-screen overflow-hidden grid grid-rows-[58fr_42fr] bg-slate-900 select-none"
      style={{ overscrollBehavior: "none", overflow: "hidden" }}
      data-testid="projector-shell"
    >
      {/* Top Row: Map (58vh) */}
      <div className="h-full w-full overflow-hidden contain-content">
        <ProjectorWorldMap worldState={worldState} />
      </div>

      {/* Bottom Row: 4 Team Tables with Active Tilt (42vh) */}
      <div className="h-full w-full overflow-hidden contain-content">
        <ProjectorFourTeamTables worldState={worldState} />
      </div>
    </main>
  );
}
