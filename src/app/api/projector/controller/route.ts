import { NextRequest, NextResponse } from "next/server";

export interface ControllerEvent {
  id: string;
  roomCode: string;
  teamId: string;
  playerName: string;
  optionId?: string | null;
  optionKey?: string | null;
  action?: "press" | "heartbeat";
  timestamp: number;
}

// Global in-memory storage for active hotseat projector controller sessions
// Map<roomCode, { events: ControllerEvent[], heartbeats: Record<teamId, number> }>
declare global {
  // eslint-disable-next-line no-var
  var __projectorControllerStore:
    | Map<
        string,
        {
          events: ControllerEvent[];
          heartbeats: Record<string, number>;
        }
      >
    | undefined;
}

const store =
  globalThis.__projectorControllerStore ??
  new Map<
    string,
    {
      events: ControllerEvent[];
      heartbeats: Record<string, number>;
    }
  >();
globalThis.__projectorControllerStore = store;

function getRoomData(roomCode: string) {
  const normalized = roomCode.toUpperCase().trim();
  let data = store.get(normalized);
  if (!data) {
    data = { events: [], heartbeats: {} };
    store.set(normalized, data);
  }
  return data;
}

// GET /api/projector/controller?roomCode=HOTSEAT&since=123456789
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get("roomCode") || "HOTSEAT";
  const since = Number(searchParams.get("since") || "0");

  const roomData = getRoomData(roomCode);
  const now = Date.now();

  // Clean old events (> 60s)
  roomData.events = roomData.events.filter((e) => now - e.timestamp < 60000);

  // Filter events strictly newer than 'since'
  const newEvents = roomData.events.filter((e) => e.timestamp > since);

  // Active controllers connected within last 15 seconds
  const activeControllers = Object.entries(roomData.heartbeats)
    .filter(([, lastSeen]) => now - lastSeen < 15000)
    .map(([teamId]) => teamId);

  return NextResponse.json({
    roomCode: roomCode.toUpperCase(),
    events: newEvents,
    activeControllers,
    serverTime: now,
  });
}

// POST /api/projector/controller
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomCode = "HOTSEAT", teamId, playerName = "Pemain", optionId, optionKey, action = "press" } = body;

    if (!teamId) {
      return NextResponse.json({ error: "MISSING_TEAM_ID" }, { status: 400 });
    }

    const roomData = getRoomData(roomCode);
    const now = Date.now();

    // Update heartbeat
    roomData.heartbeats[teamId] = now;

    if (action === "press") {
      const event: ControllerEvent = {
        id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
        roomCode: roomCode.toUpperCase(),
        teamId,
        playerName,
        optionId: optionId ?? null,
        optionKey: optionKey ?? null,
        action: "press",
        timestamp: now,
      };

      roomData.events.push(event);

      return NextResponse.json({ success: true, eventId: event.id, timestamp: now });
    }

    return NextResponse.json({ success: true, action: "heartbeat", timestamp: now });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
