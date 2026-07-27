"use client";

export default function PensieveLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full filter drop-shadow-[0_4px_12px_rgba(59,76,192,0.25)] animate-in fade-in zoom-in-95 duration-200"
      >
        <defs>
          {/* Harry Potter Pensieve Silver Memory Gradients */}
          <radialGradient id="pensieveLiquid" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="45%" stopColor="#E2E8F0" />
            <stop offset="85%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#334155" />
          </radialGradient>

          <linearGradient id="wandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id="silverWispGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#3B4CC0" />
          </linearGradient>

          <filter id="magicGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Carved Stone Pensieve Basin Bowl Base */}
        <path
          d="M 16 54 C 16 80 84 80 84 54 C 84 46 16 46 16 54 Z"
          fill="#1E293B"
          stroke="#0F172A"
          strokeWidth="3.5"
        />

        {/* Runic Carved Rim Accent */}
        <ellipse cx="50" cy="52" rx="34" ry="14" fill="#334155" stroke="#475569" strokeWidth="2" />

        {/* Glowing Silvery Liquid Memory Pool */}
        <ellipse cx="50" cy="52" rx="28" ry="10" fill="url(#pensieveLiquid)" filter="url(#magicGlow)" />

        {/* Silvery Liquid Memory Swirl Lines */}
        <path
          d="M 32 52 C 40 56 60 56 68 52 C 60 48 40 48 32 52 Z"
          fill="#FFFFFF"
          opacity="0.6"
        />

        {/* Swirling Magical Memory Wisp forming 'P' Monogram */}
        <path
          d="M 44 72 V 26 C 44 26 66 20 66 36 C 66 48 44 46 44 46"
          stroke="url(#silverWispGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#magicGlow)"
        />

        {/* Elder Wand Extracting Memory */}
        <line
          x1="78"
          y1="18"
          x2="52"
          y2="50"
          stroke="url(#wandGrad)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Wand Tip Magic Sparkle */}
        <circle cx="52" cy="50" r="3" fill="#FFFFFF" filter="url(#magicGlow)" />

        {/* Floating Magical Memory Sparkles */}
        <path
          d="M 72 26 L 73.5 29.5 L 77 31 L 73.5 32.5 L 72 36 L 70.5 32.5 L 67 31 L 70.5 29.5 Z"
          fill="#FFFFFF"
          className="animate-pulse"
        />
        <circle cx="28" cy="34" r="2" fill="#93C5FD" className="animate-pulse" />
        <circle cx="76" cy="62" r="1.5" fill="#CBD5E1" />
      </svg>
    </div>
  );
}
