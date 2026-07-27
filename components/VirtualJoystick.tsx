import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VirtualJoystickProps {
  onMove: (vector: { x: number; y: number }) => void;
  className?: string;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const activeTouchIdRef = useRef<number | null>(null);

  const RADIUS = 45; // Max displacement radius in pixels

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    e.stopPropagation();
    setIsDragging(true);
    activeTouchIdRef.current = e.pointerId;
    containerRef.current.setPointerCapture(e.pointerId);

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, RADIUS);
    const angle = Math.atan2(dy, dx);

    const normX = (Math.cos(angle) * clampedDist) / RADIUS;
    const normY = (Math.sin(angle) * clampedDist) / RADIUS;

    setTouchPos({ x: normX * RADIUS, y: normY * RADIUS });
    onMove({ x: normX, y: normY });
  }, [onMove]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || activeTouchIdRef.current !== e.pointerId || !containerRef.current) return;
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const clampedDist = Math.min(dist, RADIUS);
    const angle = Math.atan2(dy, dx);

    const normX = (Math.cos(angle) * clampedDist) / RADIUS;
    const normY = (Math.sin(angle) * clampedDist) / RADIUS;

    setTouchPos({ x: normX * RADIUS, y: normY * RADIUS });
    onMove({ x: normX, y: normY });
  }, [isDragging, onMove]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (activeTouchIdRef.current === e.pointerId && containerRef.current) {
      try {
        containerRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
      activeTouchIdRef.current = null;
      setIsDragging(false);
      setTouchPos({ x: 0, y: 0 });
      onMove({ x: 0, y: 0 });
    }
  }, [onMove]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-28 h-28 rounded-full bg-slate-950/70 border-2 border-cyan-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.3)] touch-none select-none flex items-center justify-center pointer-events-auto active:border-cyan-400 ${className}`}
    >
      {/* Outer directional indicator ring */}
      <div className="absolute inset-1 rounded-full border border-dashed border-cyan-500/20 pointer-events-none" />

      {/* Crosshair lines */}
      <div className="absolute w-full h-[1px] bg-cyan-500/20 pointer-events-none" />
      <div className="absolute h-full w-[1px] bg-cyan-500/20 pointer-events-none" />

      {/* Thumb stick */}
      <div
        style={{
          transform: `translate3d(${touchPos.x}px, ${touchPos.y}px, 0)`
        }}
        className={`w-12 h-12 rounded-full border-2 transition-transform duration-75 shadow-lg flex items-center justify-center pointer-events-none ${
          isDragging
            ? 'bg-cyan-500 border-cyan-200 text-black shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-110'
            : 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
        }`}
      >
        <div className="w-3 h-3 rounded-full bg-cyan-300 shadow-inner" />
      </div>
    </div>
  );
};
