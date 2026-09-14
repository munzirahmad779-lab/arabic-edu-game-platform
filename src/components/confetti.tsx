"use client";

import { useEffect, useRef } from "react";

type ConfettiProps = {
  active?: boolean;
  particleCount?: number;
  originY?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
};

const COLORS = [
  "#a78bfa",
  "#f0abfc",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#f472b6",
  "#fb7185",
];

export function Confetti({
  active = true,
  particleCount = 140,
  originY = 0.9,
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const spawn = (
      originXNorm: number,
      count: number,
      angleMin: number,
      angleMax: number,
      speedMin: number,
      speedMax: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        const angle =
          angleMin + Math.random() * (angleMax - angleMin);
        const speed =
          speedMin + Math.random() * (speedMax - speedMin);
        const maxLife = 2200 + Math.random() * 1400;
        particlesRef.current.push({
          x: originXNorm * width,
          y: originY * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          life: 0,
          maxLife,
        });
      }
    };

    const third = Math.max(20, Math.floor(particleCount / 3));

    // Kiri
    spawn(0.12, third, -Math.PI / 2.3, -Math.PI / 6, 8, 14);
    // Tengah (lebih tinggi)
    spawn(0.5, third, -Math.PI / 1.9, -Math.PI / 1.4, 9, 15);
    // Kanan
    spawn(0.88, third, (-Math.PI * 5) / 6, -Math.PI / 1.7, 8, 14);

    const gravity = 0.32;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += 16;
        p.vy += gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();

        if (p.life >= p.maxLife || p.y > height + 60) {
          particles.splice(i, 1);
        }
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      particlesRef.current = [];
    };
  }, [active, particleCount, originY]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden="true"
    />
  );
}