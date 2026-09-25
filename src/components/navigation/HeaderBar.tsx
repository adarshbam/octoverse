import React, { useState } from 'react';
import { Heart, Volume2, VolumeX, Briefcase } from 'lucide-react';
import { GithubIcon } from '../icons/BrandIcons';

interface HeaderBarProps {
  onOpenRecruiterDrawer: () => void;
  onOpenDrawingModal: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onOpenRecruiterDrawer,
  onOpenDrawingModal,
}) => {
  const [isMuted, setIsMuted] = useState(true);

  const toggleAudio = () => {
    setIsMuted(!isMuted);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between pointer-events-auto">
      {/* 1. Left: Developer Identity & Live Signal */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 font-black text-sm shadow-[0_0_15px_rgba(56,189,248,0.25)]">
          🐙
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-100 tracking-wide">
              Adarsh Singh
            </span>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Open for US Remote / Staff Roles
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
            Distributed Systems • Cloud Infrastructure • Full-Stack
          </p>
        </div>
      </div>

      {/* 2. Center: Girlfriend Drawing Tribute Badge */}
      <button
        onClick={onOpenDrawingModal}
        className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel hover:bg-slate-800/80 border-rose-500/20 hover:border-rose-500/40 text-xs font-semibold text-rose-300 transition-all cursor-pointer shadow-sm group active:scale-95"
        title="View the original sketchbook drawing"
      >
        <Heart size={14} className="text-rose-400 fill-rose-500/30 group-hover:scale-110 transition-transform" />
        <span>Designed by my girlfriend</span>
        <span className="text-[10px] text-slate-400">• View Sketch</span>
      </button>

      {/* 3. Right: Quick Actions & Recruiter Fast-Track */}
      <div className="flex items-center gap-2.5">
        {/* Ambient Sound Toggle */}
        <button
          onClick={toggleAudio}
          className="w-8 h-8 rounded-xl glass-panel hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
          title={isMuted ? 'Unmute Ambient Sound' : 'Mute Ambient Sound'}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-cyan-400" />}
        </button>

        {/* GitHub Link */}
        <a
          href="https://github.com/adarshbam"
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-xl glass-panel hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Visit GitHub Profile"
        >
          <GithubIcon size={15} />
        </a>

        {/* Recruiter Fast-Track Button */}
        <button
          onClick={onOpenRecruiterDrawer}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(56,189,248,0.4)] hover:shadow-[0_0_25px_rgba(56,189,248,0.6)] active:scale-95 transition-all cursor-pointer"
        >
          <Briefcase size={14} />
          <span>Recruiter Fast-Track</span>
        </button>
      </div>
    </header>
  );
};
