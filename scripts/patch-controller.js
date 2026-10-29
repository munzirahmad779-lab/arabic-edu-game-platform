const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('D:/arabic-edu-game-platform/src/app/controller/page.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

const oldHandlerRegex = /\/\/ Handle incoming game state from any source[\s\S]*?const handleIncomingGameState = useCallback\([\s\S]*?\}, \[\]\);/;

const newHandler = `// Handle incoming game state from any source (Realtime WebSocket, BroadcastChannel, or HTTP poll)
  const handleIncomingGameState = useCallback(
    (incoming: Partial<GameStateSync> & { answeredTeams?: Record<string, { optionKey?: string }> }) => {
      setIsConnected(true);

      const nextQIndex = typeof incoming.currentQuestionIndex === "number" ? incoming.currentQuestionIndex : undefined;
      const nextPhase = incoming.phase;

      // Determine if our team has answered from either incoming.answeredTeams map or incoming.hasMyTeamAnswered
      let teamHasAnswered = false;
      let teamAnswerKey: string | null = null;

      if (incoming.answeredTeams && selectedTeam) {
        const teamRec = incoming.answeredTeams[selectedTeam.id];
        if (teamRec) {
          teamHasAnswered = true;
          teamAnswerKey = teamRec.optionKey ?? null;
        }
      } else if (typeof incoming.hasMyTeamAnswered === "boolean") {
        teamHasAnswered = incoming.hasMyTeamAnswered;
        teamAnswerKey = incoming.myTeamAnswer ?? null;
      }

      // Question progression check
      const prevQ = prevQIndexRef.current;
      const isNewQuestion = typeof nextQIndex === "number" && prevQ !== -1 && prevQ !== nextQIndex;

      if (typeof nextQIndex === "number") {
        prevQIndexRef.current = nextQIndex;
      }

      // Unlock cleanly when:
      // 1. Moving to new question
      // 2. Incoming payload specifically confirms team has not answered (e.g. answeredTeams is empty on question phase)
      if (isNewQuestion || (nextPhase === "question" && !teamHasAnswered)) {
        setHasLocallyAnswered(false);
        setLastPressedKey(null);
        setStatusMessage(null);

        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([80, 40, 80]);
          } catch {}
        }
      } else if (teamHasAnswered) {
        setHasLocallyAnswered(true);
        if (teamAnswerKey) {
          setLastPressedKey(teamAnswerKey);
        }
      }

      setGameState((prev) => {
        const qIdx = typeof nextQIndex === "number" ? nextQIndex : prev.currentQuestionIndex;
        const phase = nextPhase ?? prev.phase;
        const isLocked = phase !== "question" || teamHasAnswered;

        return {
          ...prev,
          ...incoming,
          phase,
          currentQuestionIndex: qIdx,
          timerSeconds: typeof incoming.timerSeconds === "number" ? incoming.timerSeconds : prev.timerSeconds,
          totalQuestions: typeof incoming.totalQuestions === "number" ? incoming.totalQuestions : prev.totalQuestions,
          hasMyTeamAnswered: teamHasAnswered,
          myTeamAnswer: teamAnswerKey ?? (teamHasAnswered ? prev.myTeamAnswer : null),
          isLocked,
        };
      });
    },
    [selectedTeam],
  );`;

if (oldHandlerRegex.test(code)) {
  code = code.replace(oldHandlerRegex, newHandler);
  console.log('Replaced handleIncomingGameState successfully');
} else {
  console.error('Could not find oldHandlerRegex');
}

// Add manual unlock button to locked banner
const lockedBannerTarget = /Remote Anda telah dikunci\. Jawaban tidak bisa diubah hingga soal berikutnya\.\s*<\/p>\s*<\/div>/;
const lockedBannerReplacement = `Remote Anda telah dikunci. Jawaban tidak bisa diubah hingga soal berikutnya.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHasLocallyAnswered(false);
                    setLastPressedKey(null);
                    setStatusMessage(null);
                    setGameState((prev) => ({
                      ...prev,
                      hasMyTeamAnswered: false,
                      myTeamAnswer: null,
                      isLocked: prev.phase !== "question",
                    }));
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/50 border border-emerald-400/50 px-3 py-1 text-[11px] font-bold text-white transition active:scale-95"
                >
                  🔄 Buka Kunci (Jika Sudah Pindah Soal)
                </button>
              </div>`;

if (lockedBannerTarget.test(code)) {
  code = code.replace(lockedBannerTarget, lockedBannerReplacement);
  console.log('Replaced lockedBanner successfully');
} else {
  console.warn('Could not find lockedBannerTarget');
}

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Finished updating controller/page.tsx');
