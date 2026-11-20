import React, { useEffect } from 'react';
import {
  WORLD_LOOKS,
  SYNAPTIC_WORLD_SLOTS,
  useWorldLook,
  type WorldLookId,
} from '@/arboretum/components/citadel-rebuilt/looks/worldLook';

interface Props {
  onEnterArboretum: () => void;
  onBack?: () => void;
}

export function WorldAestheticSelector({ onEnterArboretum, onBack }: Props) {
  const activeLook = useWorldLook((s) => s.look);
  const setLook = useWorldLook((s) => s.setLook);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnterArboretum();
      } else if (e.key === 'Escape' && onBack) {
        e.preventDefault();
        onBack();
      } else if (e.key === '1') {
        setLook('wireframe');
      } else if (e.key === '2') {
        setLook('dream');
      } else if (e.key === '3') {
        setLook('comic');
      } else if (e.key === '4') {
        setLook('acid');
      } else if (e.key === '5') {
        setLook('minimal');
      } else if (e.key === '6') {
        setLook('papercraft');
      } else if (e.key === '7') {
        setLook('industrial');
      } else if (e.key === '8') {
        setLook('western');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onEnterArboretum, onBack, setLook]);

  const activeInfo = WORLD_LOOKS.find((l) => l.id === activeLook) ?? WORLD_LOOKS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto px-6 py-8 font-mono text-purple-100 select-none"
      style={{
        background:
          activeLook === 'dream'
            ? 'radial-gradient(circle at 50% 20%, rgba(242, 184, 214, 0.28) 0%, rgba(42, 22, 58, 0.94) 55%, #070312 100%)'
            : activeLook === 'comic'
              ? 'radial-gradient(circle at 50% 20%, rgba(255, 230, 0, 0.24) 0%, rgba(54, 12, 34, 0.95) 55%, #08030e 100%)'
              : activeLook === 'acid'
                ? 'radial-gradient(circle at 50% 20%, rgba(217, 70, 239, 0.28) 0%, rgba(30, 8, 48, 0.96) 55%, #05020a 100%)'
                : activeLook === 'minimal'
                ? 'radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.16) 0%, #000000 60%)'
                : 'radial-gradient(circle at 50% 20%, rgba(63, 240, 255, 0.14) 0%, rgba(18, 6, 42, 0.96) 55%, #05020d 100%)',
        transition: 'background 500ms ease',
      }}
    >
      {/* Header */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between border-b border-purple-500/25 pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.38em] text-amber-300/80">
            ∑NGN∑ · Sanctuary Aesthetic & Curvature Selector
          </div>
          <h1 className="citadel-display mt-1 text-2xl uppercase tracking-[0.22em] text-white">
            Choose Your World Aesthetic (16 Style Packs)
          </h1>
          <p className="mt-1 text-xs text-purple-300/70">
            Select any of the 16 Synaptic Vault World Style Packs below, or unlock yours organically through the Synaptic Vault. Each world applies its own planetary curvature (R=60 to R=2000).
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-purple-500/30 bg-purple-950/30 px-3.5 py-2 text-xs uppercase tracking-widest text-purple-300 hover:border-purple-400 hover:text-white transition-all"
          >
            ← Welcome
          </button>
        )}
      </div>

      {/* Main Content: Featured Live Aesthetics + 16-Slot Grid */}
      <div className="mx-auto my-6 w-full max-w-6xl space-y-6">
        {/* Featured Live Aesthetics (8 Live Worlds) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WORLD_LOOKS.map((look, idx) => {
            const selected = activeLook === look.id;
            const isDream = look.id === 'dream';
            const isComic = look.id === 'comic';
            const isAcid = look.id === 'acid';
            const isMinimal = look.id === 'minimal';
            const isPapercraft = look.id === 'papercraft';
            const isIndustrial = look.id === 'industrial';
            const isWestern = look.id === 'western';
            return (
              <div
                key={look.id}
                role="button"
                tabIndex={0}
                data-testid={`select-look-${look.id}`}
                onClick={() => setLook(look.id)}
                onDoubleClick={() => {
                  setLook(look.id);
                  onEnterArboretum();
                }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all cursor-pointer ${
                  selected
                    ? isDream
                      ? 'border-pink-300 shadow-[0_0_40px_rgba(244,114,182,0.4)] scale-[1.01]'
                      : isComic
                        ? 'border-amber-300 shadow-[0_0_40px_rgba(251,191,36,0.45)] scale-[1.01]'
                        : isAcid
                          ? 'border-fuchsia-400 shadow-[0_0_40px_rgba(217,70,239,0.5)] scale-[1.01]'
                          : isMinimal
                            ? 'border-white shadow-[0_0_40px_rgba(255,255,255,0.35)] scale-[1.01]'
                            : 'border-cyan-300 shadow-[0_0_40px_rgba(34,211,238,0.35)] scale-[1.01]'
                    : 'border-purple-500/30 opacity-80 hover:opacity-100 hover:border-purple-400/60'
                }`}
              >
                {/* Visual Artwork Banner */}
                <div className="relative h-44 w-full overflow-hidden" style={{ background: look.preview }}>
                  {isDream ? (
                    /* Painterly Dream illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        <radialGradient id="dreamSun" cx="72%" cy="32%" r="45%">
                          <stop offset="0%" stopColor="#fff7e6" stopOpacity="0.95" />
                          <stop offset="55%" stopColor="#ffd1dc" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#c5a3e0" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <rect width="400" height="180" fill="url(#dreamSun)" />
                      {/* Soft clouds */}
                      <ellipse cx="95" cy="48" rx="58" ry="18" fill="#fff0f6" opacity="0.65" />
                      <ellipse cx="290" cy="38" rx="70" ry="20" fill="#fff5f8" opacity="0.6" />
                      {/* Sparkles */}
                      <circle cx="60" cy="32" r="2" fill="#fff9db" />
                      <circle cx="155" cy="26" r="2.4" fill="#fff9db" />
                      <circle cx="235" cy="44" r="1.8" fill="#fff9db" />
                      <circle cx="340" cy="28" r="2.2" fill="#fff9db" />
                      {/* Distant hills */}
                      <path d="M0 135 Q110 88 230 125 T400 118 L400 180 L0 180 Z" fill="#9b8ec4" opacity="0.65" />
                      {/* Rolling green meadow */}
                      <path d="M0 142 Q90 108 195 138 T400 130 L400 180 L0 180 Z" fill="#88c468" />
                      <path d="M0 156 Q130 132 260 154 T400 148 L400 180 L0 180 Z" fill="#a8dc7a" />
                      {/* Winding cream pathway */}
                      <path d="M165 180 Q190 150 220 138 Q245 128 265 125 L285 125 Q265 136 245 150 Q225 165 215 180 Z" fill="#f7ead9" />
                      {/* Cozy cottage */}
                      <rect x="258" y="98" width="36" height="28" rx="3" fill="#f4d8c8" />
                      <polygon points="253,100 276,78 299,100" fill="#b86b77" />
                      <rect x="272" y="110" width="8" height="16" rx="1.5" fill="#d94854" />
                      {/* Painterly cypress trees */}
                      <ellipse cx="105" cy="112" rx="14" ry="28" fill="#5e7252" />
                      <ellipse cx="130" cy="118" rx="12" ry="22" fill="#738c61" />
                      <ellipse cx="322" cy="108" rx="13" ry="26" fill="#685a7c" />
                    </svg>
                  ) : isComic ? (
                    /* Pulp Comic pop-art illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#ffe600" />
                      {/* Comic sunburst rays */}
                      <g fill="#ff2a55" opacity="0.85">
                        <polygon points="200,90 80,0 120,0" />
                        <polygon points="200,90 180,0 220,0" />
                        <polygon points="200,90 280,0 320,0" />
                        <polygon points="200,90 400,30 400,70" />
                        <polygon points="200,90 400,120 400,160" />
                        <polygon points="200,90 320,180 280,180" />
                        <polygon points="200,90 220,180 180,180" />
                        <polygon points="200,90 120,180 80,180" />
                        <polygon points="200,90 0,160 0,120" />
                        <polygon points="200,90 0,70 0,30" />
                      </g>
                      {/* Ben-Day dots pattern */}
                      <defs>
                        <pattern id="bndDots" width="12" height="12" patternUnits="userSpaceOnUse">
                          <circle cx="6" cy="6" r="2.2" fill="#0b0615" opacity="0.3" />
                        </pattern>
                      </defs>
                      <rect width="400" height="180" fill="url(#bndDots)" />
                      {/* Skyline silhouettes with heavy black ink outlines */}
                      <rect x="25" y="85" width="48" height="95" fill="#00d4ff" stroke="#0b0615" strokeWidth="3" />
                      <rect x="85" y="55" width="55" height="125" fill="#ffe600" stroke="#0b0615" strokeWidth="3" />
                      <rect x="270" y="65" width="52" height="115" fill="#ff2a55" stroke="#0b0615" strokeWidth="3" />
                      <rect x="335" y="90" width="45" height="90" fill="#00e575" stroke="#0b0615" strokeWidth="3" />
                      {/* Central Action Starburst with "POW!" */}
                      <polygon
                        points="200,35 218,65 252,58 238,88 268,105 234,115 240,148 208,132 188,155 178,125 145,130 160,102 135,82 168,75 172,42 192,62"
                        fill="#ffffff"
                        stroke="#0b0615"
                        strokeWidth="4"
                      />
                      <polygon
                        points="200,42 215,67 245,61 232,87 258,102 228,111 233,138 206,125 190,145 181,119 152,123 165,99 144,82 172,76 176,48 193,64"
                        fill="#ffe600"
                      />
                      <text
                        x="200"
                        y="105"
                        textAnchor="middle"
                        fill="#ff1f4b"
                        stroke="#0b0615"
                        strokeWidth="2.5"
                        fontWeight="900"
                        fontSize="28"
                        fontFamily="Impact, sans-serif"
                        letterSpacing="1"
                      >
                        POW!
                      </text>
                      {/* Kirby Krackle Dots */}
                      <circle cx="130" cy="45" r="5" fill="#0b0615" />
                      <circle cx="140" cy="38" r="3" fill="#ff2a55" />
                      <circle cx="270" cy="42" r="4.5" fill="#0b0615" />
                      <circle cx="260" cy="36" r="3" fill="#00d4ff" />
                    </svg>
                  ) : isAcid ? (
                    /* Acid Trip Psychedelic Mandala & Mushroom illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        <radialGradient id="acidRings" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ff00ff" />
                          <stop offset="25%" stopColor="#00ffff" />
                          <stop offset="50%" stopColor="#39ff14" />
                          <stop offset="75%" stopColor="#ffe600" />
                          <stop offset="100%" stopColor="#1a042e" />
                        </radialGradient>
                      </defs>
                      <rect width="400" height="180" fill="#0e021a" />
                      {/* Swirling tie-dye background waves */}
                      <g opacity="0.65">
                        <path d="M0,0 Q100,120 200,0 T400,0 L400,180 L0,180 Z" fill="#7928ca" />
                        <path d="M0,40 Q120,160 240,40 T400,40 L400,180 L0,180 Z" fill="#ff007f" />
                        <path d="M0,90 Q150,180 280,90 T400,90 L400,180 L0,180 Z" fill="#00f0ff" />
                        <path d="M0,130 Q160,200 320,130 T400,130 L400,180 L0,180 Z" fill="#39ff14" />
                      </g>
                      {/* Sacred Mandala Concentric Circles */}
                      <circle cx="200" cy="90" r="75" fill="none" stroke="#ff00ff" strokeWidth="2.5" strokeDasharray="6,4" />
                      <circle cx="200" cy="90" r="55" fill="none" stroke="#00ffff" strokeWidth="2" strokeDasharray="4,4" />
                      <circle cx="200" cy="90" r="35" fill="none" stroke="#ffe600" strokeWidth="2.5" />
                      {/* Sacred Merkaba Star */}
                      <polygon points="200,45 235,110 165,110" fill="none" stroke="#39ff14" strokeWidth="2" />
                      <polygon points="200,135 235,70 165,70" fill="none" stroke="#ff00aa" strokeWidth="2" />
                      {/* Giant Psychedelic Mushroom */}
                      <g transform="translate(200, 110)">
                        <path d="M-10,35 Q-5,0 0,0 Q5,0 10,35 Z" fill="#ffebfa" stroke="#c44bc8" strokeWidth="1.5" />
                        <path d="M-36,0 C-36,-38 36,-38 36,0 Z" fill="#ff007f" stroke="#ffe600" strokeWidth="2" />
                        <ellipse cx="-16" cy="-16" rx="5" ry="4" fill="#39ff14" />
                        <ellipse cx="14" cy="-20" rx="6" ry="5" fill="#39ff14" />
                        <ellipse cx="0" cy="-28" rx="4" ry="4" fill="#00ffff" />
                        <ellipse cx="22" cy="-8" rx="4" ry="3" fill="#ffe600" />
                        <ellipse cx="-22" cy="-6" rx="4" ry="3" fill="#00ffff" />
                      </g>
                      {/* Floating Spores */}
                      <circle cx="90" cy="40" r="4" fill="#39ff14" />
                      <circle cx="130" cy="140" r="3.5" fill="#00ffff" />
                      <circle cx="290" cy="45" r="4.5" fill="#ff007f" />
                      <circle cx="330" cy="120" r="3" fill="#ffe600" />
                      <circle cx="70" cy="100" r="2.5" fill="#ff00aa" />
                      <circle cx="340" cy="65" r="3.5" fill="#39ff14" />
                    </svg>
                  ) : isMinimal ? (
                    /* Minimal: a void, one white light, one altar */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        <radialGradient id="minPool" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <rect width="400" height="180" fill="#000000" />
                      <ellipse cx="200" cy="128" rx="120" ry="30" fill="url(#minPool)" />
                      <ellipse cx="200" cy="128" rx="74" ry="18" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.8" />
                      {/* Altar: a single thin light */}
                      <polygon points="200,58 214,100 186,100" fill="none" stroke="#ffffff" strokeWidth="1" />
                      <line x1="200" y1="58" x2="200" y2="100" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.6" />
                      <circle cx="200" cy="124" r="3" fill="#ffffff" />
                    </svg>
                  ) : isPapercraft ? (
                    /* Tactile Papercraft Origami illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#f6ead4" />
                      <polygon points="0,120 140,65 280,125 400,80 400,180 0,180" fill="#e07a5f" stroke="#ffffff" strokeWidth="2" />
                      <polygon points="0,145 180,105 320,145 400,120 400,180 0,180" fill="#81b29a" stroke="#ffffff" strokeWidth="2" />
                      {/* Origami Crane & Folded Pine */}
                      <polygon points="200,42 168,112 200,98" fill="#fdf8ee" stroke="#3d405b" strokeWidth="1.5" />
                      <polygon points="200,42 232,112 200,98" fill="#f2cc8f" stroke="#3d405b" strokeWidth="1.5" />
                    </svg>
                  ) : isIndustrial ? (
                    /* Harsh Industrial Warehouse illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#111317" />
                      {/* Steel I-beam trusses */}
                      <g stroke="#2a2e37" strokeWidth="6">
                        <line x1="60" y1="0" x2="60" y2="180" />
                        <line x1="340" y1="0" x2="340" y2="180" />
                        <line x1="0" y1="28" x2="400" y2="28" />
                      </g>
                      {/* Sodium vapor cage lamp & glare */}
                      <circle cx="200" cy="54" r="38" fill="#ff6b00" opacity="0.28" />
                      <circle cx="200" cy="54" r="10" fill="#ffae42" />
                      {/* Hazard stripe floor */}
                      <rect x="0" y="148" width="400" height="32" fill="#22252a" />
                      <line x1="0" y1="148" x2="400" y2="148" stroke="#f59e0b" strokeWidth="4" strokeDasharray="16,12" />
                    </svg>
                  ) : isWestern ? (
                    /* Old Western Sepia & Vignette illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#d4a373" />
                      <circle cx="250" cy="62" r="28" fill="#faedcd" opacity="0.85" />
                      {/* Monument Valley Mesas */}
                      <polygon points="40,130 65,78 125,78 148,130" fill="#6f4518" />
                      <polygon points="260,130 280,88 335,88 355,130" fill="#583101" />
                      <rect x="0" y="128" width="400" height="52" fill="#8c5a2b" />
                      {/* Saguaro Cactus silhouette */}
                      <rect x="188" y="72" width="10" height="62" rx="4" fill="#2b1908" />
                      <path d="M172,96 L188,96 M172,80 L172,96 M198,104 L212,104 M212,86 L212,104" stroke="#2b1908" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  ) : look.id === 'crt' ? (
                    /* CRT Phosphor Terminal */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#031207" />
                      <g stroke="#22ff66" strokeOpacity="0.45" strokeWidth="1.2">
                        <line x1="0" y1="125" x2="400" y2="125" />
                        <line x1="0" y1="148" x2="400" y2="148" />
                        <line x1="200" y1="95" x2="40" y2="180" />
                        <line x1="200" y1="95" x2="200" y2="180" />
                        <line x1="200" y1="95" x2="360" y2="180" />
                      </g>
                      <rect x="165" y="42" width="70" height="52" fill="none" stroke="#22ff66" strokeWidth="2" />
                      <text x="200" y="74" textAnchor="middle" fill="#22ff66" fontSize="18" fontFamily="monospace">&gt;_∑NGN</text>
                    </svg>
                  ) : look.id === 'ukiyoe' ? (
                    /* Ukiyo-e Woodblock */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#f4ebd9" />
                      <circle cx="200" cy="72" r="38" fill="#d62828" />
                      <path d="M0,132 Q90,95 190,132 T400,124 L400,180 L0,180 Z" fill="#1d3557" />
                      <path d="M0,152 Q110,122 220,152 T400,145 L400,180 L0,180 Z" fill="#457b9d" />
                    </svg>
                  ) : look.id === 'cathedral' ? (
                    /* Stained Cathedral */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#120826" />
                      <circle cx="200" cy="86" r="52" fill="#6d1b7b" stroke="#090414" strokeWidth="4" />
                      <circle cx="200" cy="86" r="32" fill="#ff006e" stroke="#090414" strokeWidth="3" />
                      <circle cx="200" cy="86" r="14" fill="#ffb703" />
                    </svg>
                  ) : look.id === 'blueprint' ? (
                    /* Blueprint Atelier */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#0b3b6e" />
                      <g stroke="#e0f4ff" strokeOpacity="0.45" strokeWidth="1">
                        <circle cx="200" cy="90" r="54" fill="none" strokeDasharray="4,4" />
                        <circle cx="200" cy="90" r="34" fill="none" />
                        <line x1="120" y1="90" x2="280" y2="90" />
                        <line x1="200" y1="20" x2="200" y2="160" />
                      </g>
                    </svg>
                  ) : look.id === 'biolume' ? (
                    /* Biolume Abyss */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#020b1c" />
                      <ellipse cx="200" cy="72" rx="34" ry="22" fill="#00f5d4" opacity="0.85" />
                      <path d="M182,94 Q178,132 170,152 M200,94 Q202,135 198,156 M218,94 Q224,132 230,152" stroke="#f15bb5" strokeWidth="2.5" fill="none" />
                    </svg>
                  ) : look.id === 'kintsugi' ? (
                    /* Gilded Kintsugi */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#161419" />
                      <path d="M40,20 L155,92 L245,68 L360,155 M155,92 L110,170 M245,68 L290,15" stroke="#ffd166" strokeWidth="3.5" fill="none" />
                    </svg>
                  ) : look.id === 'solarpunk' ? (
                    /* Solarpunk Glasshouse */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#d8f3dc" />
                      <path d="M80,180 A120,120 0 0,1 320,180" fill="#52b788" opacity="0.45" stroke="#d4a017" strokeWidth="3" />
                      <circle cx="200" cy="64" r="24" fill="#ffd166" />
                    </svg>
                  ) : look.id === 'noir' ? (
                    /* Velvet Noir */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#08080b" />
                      <polygon points="150,0 250,0 340,180 60,180" fill="#ffffff" opacity="0.14" />
                      <circle cx="200" cy="82" r="22" fill="none" stroke="#e6193c" strokeWidth="3.5" />
                    </svg>
                  ) : (
                    /* Neon Wireframe illustration */
                    <svg viewBox="0 0 400 180" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
                      <rect width="400" height="180" fill="#060410" />
                      {/* Perspective grid */}
                      <g stroke="#a855f7" strokeOpacity="0.45" strokeWidth="1">
                        <line x1="0" y1="120" x2="400" y2="120" />
                        <line x1="0" y1="135" x2="400" y2="135" />
                        <line x1="0" y1="154" x2="400" y2="154" />
                        <line x1="0" y1="176" x2="400" y2="176" />
                        <line x1="200" y1="110" x2="20" y2="180" />
                        <line x1="200" y1="110" x2="110" y2="180" />
                        <line x1="200" y1="110" x2="200" y2="180" />
                        <line x1="200" y1="110" x2="290" y2="180" />
                        <line x1="200" y1="110" x2="380" y2="180" />
                      </g>
                      {/* Wireframe pyramid & octahedron */}
                      <polygon points="200,34 152,118 248,118" fill="none" stroke="#3ff0ff" strokeWidth="1.6" />
                      <line x1="200" y1="34" x2="200" y2="118" stroke="#3ff0ff" strokeWidth="1.1" strokeOpacity="0.7" />
                      <circle cx="200" cy="82" r="10" fill="none" stroke="#ff4fd8" strokeWidth="1.4" />
                      <circle cx="200" cy="82" r="3.5" fill="#ffc95c" />
                    </svg>
                  )}
                  <div className="absolute left-3.5 top-3.5 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md">
                    {String(idx + 1).padStart(2, '0')} · R={look.curvatureRadius}
                  </div>
                  {selected && (
                    <div className="absolute right-3.5 top-3.5 rounded-full border border-emerald-300/60 bg-emerald-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200 backdrop-blur-md">
                      ✓ Selected
                    </div>
                  )}
                </div>

                {/* Card Copy */}
                <div className="flex flex-1 items-center justify-between bg-[#0a0516]/95 px-5 py-4">
                  <div>
                    <div className="text-base font-bold uppercase tracking-[0.16em] text-white">
                      {look.name}
                    </div>
                    <div className="mt-1 text-xs text-purple-200/75">{look.tagline}</div>
                  </div>
                  <span className="ml-4 shrink-0 rounded-lg border border-purple-400/35 bg-purple-950/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-purple-200 group-hover:border-white/50 group-hover:text-white">
                    {selected ? 'Active' : 'Select'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* All 16 Archetype Slots Overview */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-purple-300/70">
              All 16 Synaptic Vault Aesthetic Slots (With Bespoke Curvature)
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-purple-400/50">
              {WORLD_LOOKS.length} Live · {16 - WORLD_LOOKS.length} Queued for Craft
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {SYNAPTIC_WORLD_SLOTS.map((item) => {
              const unlocked = !!item.lookId;
              const isCurrent = item.lookId === activeLook;
              return (
                <button
                  key={item.slot}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => item.lookId && setLook(item.lookId)}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all ${
                    isCurrent
                      ? 'border-pink-300 bg-pink-950/30 text-white shadow-[0_0_16px_rgba(244,114,182,0.3)]'
                      : unlocked
                        ? 'border-purple-400/40 bg-purple-950/30 text-purple-100 hover:border-purple-300 cursor-pointer'
                        : 'border-purple-500/15 bg-black/30 text-purple-400/35 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold tracking-widest">
                    <span>#{String(item.slot).padStart(2, '0')} · R={item.curvatureRadius}</span>
                    <span>{unlocked ? '✦' : '◌'}</span>
                  </div>
                  <div className="mt-2">
                    <div className="truncate text-[10px] font-bold uppercase tracking-wider">
                      {item.title}
                    </div>
                    <div className="mt-0.5 truncate text-[8px] font-semibold text-amber-300/80">
                      {item.archetype}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[8px] leading-tight opacity-65">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-purple-500/25 pt-4">
        <div className="text-xs text-purple-200/80">
          Active Aesthetic:{' '}
          <span className="font-bold uppercase tracking-wider text-amber-300">
            {activeInfo.name}
          </span>{' '}
          <span className="text-purple-400/60">
            — You can also switch aesthetics live inside the Arboretum via Settings (⚙ → Worlds).
          </span>
        </div>
        <button
          type="button"
          data-testid="enter-arboretum-btn"
          onClick={onEnterArboretum}
          className="rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-amber-400 px-7 py-3 text-xs font-bold uppercase tracking-[0.22em] text-black shadow-[0_0_30px_rgba(244,114,182,0.45)] transition-all hover:scale-105 hover:brightness-110 cursor-pointer"
        >
          Enter The Arboretum ({activeInfo.name}) ➔
        </button>
      </div>
    </div>
  );
}
