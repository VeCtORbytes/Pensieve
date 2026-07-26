"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, X, Sparkles, FileText, Download } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  scriptText: string;
  onClose: () => void;
}

export default function AudioPlayer({ audioUrl, scriptText, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [audioUrl]);

  function togglePlay() {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }

  function formatSecs(secs: number) {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function handleDownloadAudio() {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "Pensieve-Audio-Overview.mp3";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-[#111622] border border-[#222B3D] rounded-3xl shadow-2xl p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 text-[#E6EDF3]">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222B3D] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#8B5CF6] flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-serif-display font-medium text-[#E6EDF3]">
              AI Audio Overview
            </h4>
            <p className="text-[10px] text-[#8B949E]">Synthesized Podcast Discussion</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownloadAudio}
            title="Download MP3 Audio"
            className="p-1.5 text-[#8B949E] hover:text-[#38BDF8] hover:bg-[#192030] rounded-xl transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Audio Player"
            className="p-1.5 text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#192030] rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Audio Controls & Progress */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white flex items-center justify-center transition shrink-0 cursor-pointer shadow-md"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-[#090D14] rounded-lg appearance-none cursor-pointer accent-[#8B5CF6]"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#8B949E]">
            <span>{formatSecs(currentTime)}</span>
            <span>{formatSecs(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="text-[#8B949E] hover:text-[#E6EDF3] p-1 cursor-pointer shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Script Text View */}
      <div className="p-3 bg-[#090D14] rounded-2xl border border-[#222B3D] space-y-1.5 max-h-28 overflow-y-auto text-xs leading-relaxed text-[#8B949E]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8] flex items-center gap-1">
          <FileText className="w-3 h-3" /> Script Transcript
        </p>
        <p className="whitespace-pre-wrap">{scriptText}</p>
      </div>
    </div>
  );
}
