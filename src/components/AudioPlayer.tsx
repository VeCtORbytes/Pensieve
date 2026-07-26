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
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-white border border-[#E2E7EA] rounded-3xl shadow-2xl p-5 space-y-3.5 animate-in slide-in-from-bottom duration-200 text-[#141A22]">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0] flex items-center justify-center">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-serif-display font-medium text-[#141A22]">
              AI Audio Overview
            </h4>
            <p className="text-[10px] text-neutral-400">Synthesized Podcast Discussion</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownloadAudio}
            title="Download MP3 Audio"
            className="p-1.5 text-neutral-400 hover:text-[#3B4CC0] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Audio Player"
            className="p-1.5 text-neutral-400 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
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
          className="w-10 h-10 rounded-full bg-[#141A22] hover:bg-[#3B4CC0] text-white flex items-center justify-center transition shrink-0 cursor-pointer shadow-sm"
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
            className="w-full h-1.5 bg-[#F5F7F8] rounded-lg appearance-none cursor-pointer accent-[#3B4CC0]"
          />
          <div className="flex justify-between text-[10px] font-mono text-neutral-400">
            <span>{formatSecs(currentTime)}</span>
            <span>{formatSecs(duration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="text-neutral-400 hover:text-[#141A22] p-1 cursor-pointer shrink-0"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Script Text View */}
      <div className="p-3 bg-[#F5F7F8] rounded-2xl border border-[#E2E7EA] space-y-1.5 max-h-28 overflow-y-auto text-xs leading-relaxed text-neutral-700">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#3B4CC0] flex items-center gap-1">
          <FileText className="w-3 h-3" /> Script Transcript
        </p>
        <p className="whitespace-pre-wrap">{scriptText}</p>
      </div>
    </div>
  );
}
