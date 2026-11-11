"use client";

import { useEffect } from "react";
import { pauseBackgroundAudio, resumeBackgroundAudio } from "@/lib/bg-audio-events";

/**
 * Dipasang di halaman main game mandiri: musik latar situs dijeda selama
 * halaman game terbuka supaya tidak bertumpuk dengan musik game itu
 * sendiri, lalu dilanjutkan lagi saat guru meninggalkan halaman.
 */
export function PauseGlobalAudio() {
  useEffect(() => {
    pauseBackgroundAudio();
    return () => {
      resumeBackgroundAudio();
    };
  }, []);
  return null;
}
