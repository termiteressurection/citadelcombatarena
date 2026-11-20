import { useWorldLook } from './citadel-rebuilt/looks/worldLook';

const CRTOverlay = ({ mentalLoad = 0 }: { mentalLoad?: number }) => {
  const look = useWorldLook((s) => s.look);
  if (look === 'dream') {
    return (
      <div
        className="absolute inset-0 z-[5] pointer-events-none overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 58%, rgba(255, 214, 232, 0.18) 100%)',
        }}
      />
    );
  }
  if (look === 'comic') {
    return (
      <div
        className="absolute inset-0 z-[5] pointer-events-none overflow-hidden"
        style={{
          boxShadow: 'inset 0 0 0 4px #0c0816, inset 0 0 40px rgba(12, 8, 22, 0.35)',
        }}
      />
    );
  }
  if (look === 'minimal') return null;
  if (look === 'acid') {
    return (
      <div
        className="absolute inset-0 z-[5] pointer-events-none overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 62%, rgba(121, 40, 202, 0.22) 100%)',
        }}
      />
    );
  }
  // Base intensity + scaling based on mental load
  const intensity = Math.min(1.0, mentalLoad / 100);
  const scanBarOpacity = 0.07 + intensity * 0.2;
  const vhsNoiseOpacity = 0.13 + intensity * 0.4;
  const caIntensity = 0.05 + intensity * 0.15;
  const flickerOpacity = 0.026 + intensity * 0.1;
  const crtFlickerMax = 0.955 - intensity * 0.2;
  
  return (
    <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
      {/* Scanlines */}
      <div className="absolute inset-0" style={{
        background: `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, hsl(270 60% 15% / 0.14) 2px, hsl(270 60% 15% / 0.14) 4px)`,
        animation: "scanlines 8s linear infinite",
      }} />
      {/* VHS tracking bar */}
      <div className="absolute left-0 right-0 h-[100px]" style={{
        background: `linear-gradient(to bottom, transparent, hsl(280 80% 60% / ${scanBarOpacity}) 30%, hsl(330 80% 70% / ${scanBarOpacity + 0.05}) 50%, hsl(280 80% 60% / ${scanBarOpacity}) 70%, transparent)`,
        animation: intensity > 0.5 ? "scanbar 2s ease-in-out infinite" : "scanbar 5s ease-in-out infinite",
      }} />
      {/* VHS noise band */}
      <div className="absolute left-0 right-0 h-[4px]" style={{
        background: `hsl(160 90% 60% / ${vhsNoiseOpacity})`,
        animation: intensity > 0.8 ? "vhsnoise 1s steps(12) infinite" : "vhsnoise 3s steps(12) infinite",
      }} />
      {/* Chromatic aberration fringing */}
      <div className="absolute inset-0" style={{
        boxShadow: `inset 2px 0 8px hsl(330 80% 50% / ${caIntensity}), inset -2px 0 8px hsl(270 80% 50% / ${caIntensity})`,
      }} />
      {/* Screen flicker */}
      <div className="absolute inset-0" style={{
        background: `hsl(270 50% 50% / ${flickerOpacity})`,
        animation: intensity > 0.3 ? "crtflicker 0.05s infinite" : "crtflicker 0.1s infinite",
      }} />
      {/* Corner vignette */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at center, transparent 45%, hsl(270 30% 3% / 0.49) 100%)",
      }} />
      <style>{`
        @keyframes scanlines { 0% { transform: translateY(0); } 100% { transform: translateY(4px); } }
        @keyframes scanbar { 0%, 100% { top: -100px; } 50% { top: 100%; } }
        @keyframes vhsnoise { 0% { top: 10%; } 8% { top: 35%; } 16% { top: 72%; } 24% { top: 15%; } 32% { top: 88%; } 40% { top: 42%; } 48% { top: 65%; } 56% { top: 8%; } 64% { top: 91%; } 72% { top: 28%; } 80% { top: 55%; } 88% { top: 78%; } 100% { top: 10%; } }
        @keyframes crtflicker { 0%, 100% { opacity: 1; } 50% { opacity: ${crtFlickerMax}; } }
      `}</style>
    </div>
  );
};

export default CRTOverlay;
