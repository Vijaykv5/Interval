"use client";

import { useEffect } from "react";

export function CursorGlow() {
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--cursor-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      className="cursor-glow"
      aria-hidden
      style={{
        position: "fixed",
        left: "var(--cursor-x, 50vw)",
        top: "var(--cursor-y, 50vh)",
        width: "min(80vw, 600px)",
        height: "min(80vw, 600px)",
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255, 210, 142, 0.22) 0%, rgba(210, 140, 80, 0.08) 35%, transparent 65%)",
        filter: "blur(40px)",
        pointerEvents: "none",
        zIndex: 9998,
      }}
    />
  );
}
