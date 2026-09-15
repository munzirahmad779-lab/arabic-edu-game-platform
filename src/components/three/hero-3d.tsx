"use client";

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron } from "@react-three/drei";
import type { Mesh } from "three";

function RotatingShape() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.2;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.6} floatIntensity={0.8}>
      <Icosahedron ref={meshRef} args={[1.4, 1]}>
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#7c3aed"
          emissiveIntensity={0.35}
          wireframe
          roughness={0.2}
          metalness={0.6}
        />
      </Icosahedron>
      <Icosahedron args={[0.9, 0]}>
        <meshStandardMaterial
          color="#c4b5fd"
          emissive="#a78bfa"
          emissiveIntensity={0.6}
          transparent
          opacity={0.35}
        />
      </Icosahedron>
    </Float>
  );
}

export function Hero3D() {
  const [mounted, setMounted] = useState(false);
  const [canRender, setCanRender] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Skip kalau user minta reduced motion
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setCanRender(false);
    }
  }, []);

  if (!mounted || !canRender) {
    // Fallback: ikon statis
    return (
      <div className="flex h-64 w-full items-center justify-center sm:h-80">
        <div className="text-8xl opacity-30">✦</div>
      </div>
    );
  }

  return (
    <div className="relative h-64 w-full sm:h-80">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 3, 3]} intensity={1.2} />
        <pointLight position={[-3, -3, -3]} intensity={0.6} color="#f0abfc" />
        <RotatingShape />
      </Canvas>
    </div>
  );
}