"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  RefreshCw,
  Mic,
  Sparkles,
  Download,
  Sliders,
  FileText,
  FastForward,
} from "lucide-react";
import { VoicePersona, VoiceName } from "@/app/api/audio-summary/route";

interface AudioData {
  scriptText: string;
  segments: string[];
  audioUrl: string;
  persona: VoicePersona;
  voice: VoiceName;
}

export default function AudioOverviewModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<AudioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings state
  const [persona, setPersona] = useState<VoicePersona>("casual");
  const [voice, setVoice] = useState<VoiceName>("alloy");
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function generateAudio(selectedPersona = persona, selectedVoice = voice) {
    try {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);

      const res = await fetch("/api/audio-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, persona: selectedPersona, voice: selectedVoice }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate audio overview");
      }

      const result: AudioData = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to synthesize audio");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    generateAudio();
  }, [notebookId]);

  // Audio playback rate sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Track progress and active segment
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 1;
    setCurrentTime(cur);
    setDuration(dur);

    if (data?.segments && data.segments.length > 0) {
      const progressRatio = cur / dur;
      const index = Math.min(
        data.segments.length - 1,
        Math.floor(progressRatio * data.segments.length)
      );
      setActiveSegmentIndex(index);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] p-5 sm:p-7 shadow-2xl border border-[#E2E7EA] text-[#141A22] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0]">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-serif-display font-normal text-[#141A22]">
                Audio Podcast Overview
              </h2>
              <p className="text-[11px] text-neutral-500">
                Customizable Voice Personas & Synchronized Transcript Player
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Persona Selector */}
        <div className="py-3 border-b border-[#E2E7EA] bg-[#F5F7F8] px-4 -mx-5 sm:-mx-7 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-neutral-600 text-[11px] uppercase tracking-wider flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[#3B4CC0]" /> Persona:
            </span>

            {(["casual", "academic", "eli5", "debate"] as VoicePersona[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPersona(p);
                  generateAudio(p, voice);
                }}
                className={`px-3 py-1 rounded-full font-medium transition cursor-pointer text-[11px] capitalize ${
                  persona === p
                    ? "bg-[#141A22] text-white font-semibold shadow-xs"
                    : "bg-white text-neutral-600 hover:text-[#141A22] border border-[#E2E7EA]"
                }`}
              >
                {p === "eli5" ? "ELI5" : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Voice Dropdown */}
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-neutral-500 font-medium">Voice:</span>
              <select
                value={voice}
                onChange={(e) => {
                  const newVoice = e.target.value as VoiceName;
                  setVoice(newVoice);
                  generateAudio(persona, newVoice);
                }}
                className="bg-white border border-[#E2E7EA] rounded-lg px-2 py-1 text-xs text-[#141A22] font-medium outline-none cursor-pointer"
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="nova">Nova (Warm)</option>
                <option value="onyx">Onyx (Deep)</option>
                <option value="echo">Echo (Clear)</option>
                <option value="fable">Fable (Expressive)</option>
                <option value="shimmer">Shimmer (Clear)</option>
              </select>
            </div>

            {/* Speed Multiplier */}
            <div className="flex items-center gap-1 text-[11px]">
              <FastForward className="w-3.5 h-3.5 text-neutral-400" />
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] cursor-pointer ${
                    playbackRate === rate
                      ? "bg-[#3B4CC0] text-white font-bold"
                      : "text-neutral-500 hover:text-[#141A22]"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 my-3 overflow-hidden bg-[#F5F7F8] rounded-3xl border border-[#E2E7EA] flex flex-col">
          {isLoading ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#3B4CC0]" />
              <p className="text-xs font-semibold text-[#141A22]">
                Synthesizing AI Podcast Script & Voice ({persona.toUpperCase()} mode)...
              </p>
              <p className="text-[11px] text-neutral-400 max-w-xs">
                Generating natural speech audio from your uploaded notebook sources.
              </p>
            </div>
          ) : error ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
              <p className="text-xs font-semibold text-amber-600">{error}</p>
              <button
                type="button"
                onClick={() => generateAudio()}
                className="px-4 py-2 rounded-xl bg-[#141A22] text-white text-xs font-semibold hover:bg-[#3B4CC0] transition cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : data ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Synchronized Transcript Display */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white">
                <div className="text-[10px] font-mono font-semibold uppercase text-neutral-400 tracking-wider flex items-center justify-between border-b border-[#E2E7EA] pb-2">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#3B4CC0]" />
                    Synchronized Podcast Transcript
                  </span>
                  <span>Click line to seek</span>
                </div>

                <div className="space-y-4">
                  {(data.segments || [data.scriptText]).map((seg, idx) => {
                    const isActive = idx === activeSegmentIndex && isPlaying;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (audioRef.current) {
                            const targetRatio = idx / (data.segments.length || 1);
                            audioRef.current.currentTime = targetRatio * duration;
                          }
                        }}
                        className={`p-4 rounded-2xl border transition cursor-pointer leading-relaxed text-xs ${
                          isActive
                            ? "bg-[#3B4CC0]/10 border-[#3B4CC0] text-[#141A22] font-medium shadow-xs"
                            : "bg-[#F5F7F8] hover:bg-white border-[#E2E7EA] text-neutral-600"
                        }`}
                      >
                        <p>{seg}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audio Controls Bar */}
              <div className="p-4 bg-[#141A22] text-white border-t border-[#E2E7EA] flex flex-col space-y-2">
                <audio
                  ref={audioRef}
                  src={data.audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Progress Slider */}
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-neutral-400 w-10">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 accent-[#3B4CC0] h-1.5 bg-neutral-700 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-neutral-400 w-10 text-right">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Play Button & Download Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-3 rounded-full bg-[#3B4CC0] hover:bg-indigo-600 text-white transition cursor-pointer shadow-md"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                    </button>
                    <div>
                      <h4 className="text-xs font-semibold text-white capitalize">
                        {persona} Mode Overview
                      </h4>
                      <p className="text-[10px] text-neutral-400">Voice: {voice}</p>
                    </div>
                  </div>

                  <a
                    href={data.audioUrl}
                    download="Notebook-Audio-Overview.mp3"
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP3</span>
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
