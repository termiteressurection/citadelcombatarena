import { tokens } from '../styles';

export function SigmaSkull() {
  const pulseDuration = Math.max(0.5, 4);
  
  return (
    <div style={{
      width: 24,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: '100%',
          filter: `drop-shadow(0 0 ${Math.min(10, 0)}px ${tokens.accent})`,
          animation: `sigma-pulse ${pulseDuration}s ease-in-out infinite alternate`
        }}
      >
        {/* Skull Outline */}
        <path
          d="M12 2C7.58 2 4 5.58 4 10C4 12.45 5.1 14.65 6.83 16.14L7.5 21H16.5L17.17 16.14C18.9 14.65 20 12.45 20 10C20 5.58 16.42 2 12 2Z"
          stroke={tokens.accent}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Eye Sockets */}
        <path
          d="M9 10C9 10.5523 8.55228 11 8 11C7.44772 11 7 10.5523 7 10C7 9.44772 7.44772 9 8 9C8.55228 9 9 9.44772 9 10Z"
          fill={tokens.accent}
        />
        <path
          d="M17 10C17 10.5523 16.5523 11 16 11C15.4477 11 15 10.5523 15 10C15 9.44772 15.4477 9 16 9C16.5523 9 17 9.44772 17 10Z"
          fill={tokens.accent}
        />
        {/* Forensic Lines (Nose/Teeth) */}
        <path
          d="M12 13V15"
          stroke={tokens.accent}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M10 18H14M10 20H14"
          stroke={tokens.accentDim}
          strokeWidth="1"
        />
      </svg>
      
      <style>{`
        @keyframes sigma-pulse {
          from { opacity: 0.4; transform: scale(0.95); }
          to { opacity: 0.9; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
