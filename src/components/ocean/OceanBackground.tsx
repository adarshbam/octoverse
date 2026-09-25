import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  swaySpeed: number;
  swayAmplitude: number;
  baseOpacity: number;
  color: string;
  phase: number;
  vx: number;
  vy: number;
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  wobbleSpeed: number;
  wobbleAmplitude: number;
  phase: number;
  opacity: number;
  vx: number;
  vy: number;
}

export const OceanBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, moved: true };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Initialize Marine Dust Particles
    const particlesCount = Math.floor(Math.min(width, height) / 18);
    const particles: Particle[] = Array.from({ length: particlesCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.6,
      speedY: -(Math.random() * 0.35 + 0.15),
      swaySpeed: Math.random() * 0.02 + 0.008,
      swayAmplitude: Math.random() * 1.5 + 0.5,
      baseOpacity: Math.random() * 0.4 + 0.2,
      color: Math.random() > 0.4 ? 'rgba(56, 189, 248, ' : 'rgba(52, 211, 153, ',
      phase: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
    }));

    // Initialize Rising Bubbles
    const bubblesCount = 24;
    const bubbles: Bubble[] = Array.from({ length: bubblesCount }, () => ({
      x: Math.random() * width,
      y: height + Math.random() * 200,
      radius: Math.random() * 5 + 2.5,
      speedY: -(Math.random() * 0.8 + 0.4),
      wobbleSpeed: Math.random() * 0.04 + 0.02,
      wobbleAmplitude: Math.random() * 2 + 1,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.35 + 0.15,
      vx: 0,
      vy: 0,
    }));

    let time = 0;

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Abyssal Ocean Radial Gradient
      const gradient = ctx.createRadialGradient(
        width * 0.5,
        height * 0.3,
        50,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      gradient.addColorStop(0, '#0c2340'); // Soft sunlit deep oceanic blue
      gradient.addColorStop(0.35, '#051329'); // Mid-depth navy
      gradient.addColorStop(0.75, '#020617'); // Abyssal twilight
      gradient.addColorStop(1, '#01030a'); // Trench black
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Mouse Water Displacement Physics
      const { x: mx, y: my, moved } = mouseRef.current;

      // 3. Render Marine Dust Particles
      particles.forEach((p) => {
        p.phase += p.swaySpeed;
        p.x += Math.sin(p.phase) * p.swayAmplitude + p.vx;
        p.y += p.speedY + p.vy;

        // Mouse displacement
        if (moved) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            const force = (1 - dist / 100) * 1.5;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }
        p.vx *= 0.92;
        p.vy *= 0.92;

        // Wrap around boundaries
        if (p.y < -10) p.y = height + 10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const pulseOpacity = p.baseOpacity + Math.sin(p.phase * 2) * 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${Math.max(0.05, pulseOpacity)})`;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
        ctx.shadowBlur = 6;
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // 4. Render Translucent Rising Bubbles
      bubbles.forEach((b) => {
        b.phase += b.wobbleSpeed;
        b.x += Math.sin(b.phase) * b.wobbleAmplitude + b.vx;
        b.y += b.speedY + b.vy;

        // Mouse push
        if (moved) {
          const dx = b.x - mx;
          const dy = b.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0) {
            const force = (1 - dist / 120) * 2;
            b.vx += (dx / dist) * force;
            b.vy += (dy / dist) * force;
          }
        }
        b.vx *= 0.94;
        b.vy *= 0.94;

        // Respawn at bottom
        if (b.y < -20) {
          b.y = height + Math.random() * 50;
          b.x = Math.random() * width;
        }

        // Draw bubble body
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(186, 230, 253, ${b.opacity})`;
        ctx.lineWidth = 1;
        ctx.fillStyle = `rgba(56, 189, 248, ${b.opacity * 0.15})`;
        ctx.fill();
        ctx.stroke();

        // Draw tiny bubble specular highlight (the little reflection shine)
        ctx.beginPath();
        ctx.arc(
          b.x - b.radius * 0.35,
          b.y - b.radius * 0.35,
          b.radius * 0.25,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.8})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* 1. Canvas Dynamic Particles & Bubbles */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 2. Ethereal Caustic Sunlight Cones from surface */}
      <div className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none animate-caustics">
        <div
          className="absolute -top-[20%] left-[10%] w-[35%] h-[120%] bg-gradient-to-b from-cyan-400/25 via-cyan-600/5 to-transparent transform -rotate-12 blur-3xl"
        />
        <div
          className="absolute -top-[20%] right-[15%] w-[40%] h-[130%] bg-gradient-to-b from-emerald-400/20 via-teal-600/5 to-transparent transform rotate-12 blur-3xl"
        />
      </div>

      {/* 3. Subtle Vignette Border */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(1,3,10,0.85)_100%] pointer-events-none" />
    </div>
  );
};
