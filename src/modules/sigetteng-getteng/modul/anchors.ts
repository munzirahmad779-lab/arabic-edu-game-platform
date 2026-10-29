/** Titik pegangan tali per karakter PER FRAME (fraksi sel 0..1).
 *  LOG 30 (28 Okt 19:4x): lembar JOSEPH putaran 2 terpasang atas keputusan user
 *  ("ambil hasil dari joseph saja"). Titik hasil ukur grounding pada krop per sel
 *  lembar Joseph (joseph-final-crops/). */

export interface AnchorFrame {
  x: number;
  y: number;
}

export interface Anchor {
  side: "L" | "R";
  top: number;
  frames: AnchorFrame[];
  rearFrames?: AnchorFrame[];
}

export const ANCHORS: Record<string, Anchor> = {
  tarsius: {
    side: "R",
    top: 0.4805,
    frames: [
      { x: 0.794, y: 0.708 },
      { x: 0.798, y: 0.723 },
      { x: 0.735, y: 0.68 },
      { x: 0.76, y: 0.705 },
    ],
    rearFrames: [
      { x: 0.714, y: 0.743 },
      { x: 0.712, y: 0.744 },
      { x: 0.64, y: 0.698 },
      { x: 0.613, y: 0.727 },
    ],
  },
  anoa: {
    side: "R",
    top: 0.4961,
    frames: [
      { x: 0.826, y: 0.519 },
      { x: 0.826, y: 0.524 },
      { x: 0.827, y: 0.494 },
      { x: 0.852, y: 0.496 },
    ],
    rearFrames: [
      { x: 0.753, y: 0.524 },
      { x: 0.758, y: 0.526 },
      { x: 0.737, y: 0.489 },
      { x: 0.766, y: 0.499 },
    ],
  },
  maleo: {
    side: "L",
    top: 0.5156,
    frames: [
      { x: 0.12, y: 0.525 },
      { x: 0.127, y: 0.519 },
      { x: 0.124, y: 0.496 },
      { x: 0.138, y: 0.5 },
    ],
    rearFrames: [
      { x: 0.214, y: 0.558 },
      { x: 0.219, y: 0.556 },
      { x: 0.218, y: 0.535 },
      { x: 0.233, y: 0.535 },
    ],
  },
  yaki: {
    side: "L",
    top: 0.5078,
    frames: [
      { x: 0.132, y: 0.538 },
      { x: 0.165, y: 0.535 },
      { x: 0.14, y: 0.518 },
      { x: 0.182, y: 0.523 },
    ],
    rearFrames: [
      { x: 0.185, y: 0.566 },
      { x: 0.21, y: 0.58 },
      { x: 0.191, y: 0.541 },
      { x: 0.228, y: 0.565 },
    ],
  },
};
