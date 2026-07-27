"use client";

export default function PensieveLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        <defs>
          <linearGradient id="pensieveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B4CC0" />
            <stop offset="50%" stopColor="#1D9E75" />
            <stop offset="100%" stopColor="#141A22" />
          </linearGradient>
          <linearGradient id="basinRim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#141A22" />
            <stop offset="100%" stopColor="#3B4CC0" />
          </linearGradient>
        </defs>

        {/* Memory Basin Bowl Outer Shadow & Rim */}
        <path
          d="M 18 52 C 18 78 82 78 82 52 C 82 45 18 45 18 52 Z"
          fill="url(#basinRim)"
          stroke="#141A22"
          strokeWidth="3"
        />

        {/* Liquid Swirl Surface */}
        <ellipse cx="50" cy="50" rx="30" ry="12" fill="#F5F7F8" stroke="#E2E7EA" strokeWidth="1.5" />
        <ellipse cx="50" cy="50" rx="22" ry="8" fill="url(#pensieveGrad)" opacity="0.85" />

        {/* Swirling 'P' Memory Thread */}
        <path
          d="M 44 68 V 28 C 44 28 64 24 64 38 C 64 50 44 48 44 48"
          stroke="url(#pensieveGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Inner Glowing Memory Node Sparkle */}
        <circle cx="64" cy="38" r="3" fill="#1D9E75" />
        <circle cx="44" cy="28" r="2.5" fill="#3B4CC0" />
      </svg>
    </div>
  );
}
