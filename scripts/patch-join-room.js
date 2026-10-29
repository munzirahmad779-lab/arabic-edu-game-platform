const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('D:/arabic-edu-game-platform/src/app/join/room/page.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Strict 404 ended check in loadSession
code = code.replace(
  'if (res.status === 404 && (raw.ended || raw.error === "INVALID_JOIN_TOKEN")) {',
  'if (res.status === 404 && raw.ended === true) {'
);

// 2. Persist room_code and student_name in localStorage
const setSessionTarget = /setSession\(incoming\);\s*setLoadError\(""\);/;
const setSessionReplacement = `setSession(incoming);
      setLoadError("");
      if (incoming.room_code && typeof window !== "undefined") {
        try {
          localStorage.setItem("magguru_last_room_code", incoming.room_code);
          if (incoming.participant_name) {
            localStorage.setItem("magguru_last_student_name", incoming.participant_name);
          }
        } catch {}
      }`;
code = code.replace(setSessionTarget, setSessionReplacement);

// 3. Fallback to localStorage in sessionEnded UI
const sessionEndedTarget = /if \(sessionEnded\) \{\s*const returnJoinUrl = endedRoomCode \? `\/join\?code=\$\{encodeURIComponent\(endedRoomCode\)\}` : "\/join";/;
const sessionEndedReplacement = `if (sessionEnded) {
    let effectiveCode = endedRoomCode;
    let effectiveName = "";
    if (typeof window !== "undefined") {
      try {
        if (!effectiveCode) effectiveCode = localStorage.getItem("magguru_last_room_code");
        effectiveName = localStorage.getItem("magguru_last_student_name") || "";
      } catch {}
    }
    const returnJoinUrl = effectiveCode
      ? \`/join?code=\${encodeURIComponent(effectiveCode)}\${effectiveName ? \`&name=\${encodeURIComponent(effectiveName)}\` : ""}\`
      : "/join";`;
code = code.replace(sessionEndedTarget, sessionEndedReplacement);

// 4. Update UI labels to use effectiveCode
code = code.replace(
  '{endedRoomCode && (',
  '{effectiveCode && ('
);
code = code.replace(
  'Kode Ruangan: {endedRoomCode}',
  'Kode Ruangan: {effectiveCode}'
);
code = code.replace(
  '{endedRoomCode ? "Gabung ke Sesi Baru" : t.room_back_join}',
  '{effectiveCode ? `Gabung ke Sesi Baru (${effectiveCode})` : t.room_back_join}'
);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Finished updating join/room/page.tsx');
