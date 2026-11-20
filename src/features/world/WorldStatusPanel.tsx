import type { ReactNode } from 'react';
import type { RitualStatus } from '@/core/rules/ritualEngine';
import type { HubDensityResult } from './hubDensity';
import type { CitadelStateModel } from '@/core/model/types';
import { tokens } from '@/app/styles';
import { SearchAltar } from './SearchAltar';

interface Props {
  state: CitadelStateModel;
  ritual: RitualStatus;
  density: HubDensityResult;
  onOpenFloppy: () => void;
  onOpenMindMap: () => void;
  onOpenSynapticVault: () => void;
  onOpenDesktopWorld?: () => void;
  onTeleport: (day: import('@/core/model/types').LocalDay) => void;
}

const TIER_COLORS: Record<string, string> = {
  empty: tokens.textDim,
  sparse: tokens.textMuted,
  growing: tokens.midday,
  dense: tokens.accent,
  saturated: tokens.commune,
};

const PHASE_COLORS: Record<string, string> = {
  morning: tokens.morning,
  midday: tokens.midday,
  reflect: tokens.reflect,
  commune: tokens.commune,
};

export function WorldStatusPanel({ state, ritual, density, onOpenFloppy, onOpenMindMap, onOpenSynapticVault, onOpenDesktopWorld, onTeleport }: Props) {
  const anchorComplete = state.days[state.today]?.dailyAnchorComplete ?? false;

  return (
    <aside
      style={{
        width: 200,
        minWidth: 200,
        borderLeft: `1px solid ${tokens.border}`,
        background: tokens.surface,
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflowY: 'auto',
        fontFamily: tokens.fontMono,
      }}
    >
      <Section label="Phase">
        <StatusRow
          label={ritual.phase}
          color={PHASE_COLORS[ritual.phase] ?? tokens.text}
          dot={ritual.sealed}
        />
      </Section>

      <Section label="Anchor">
        <StatusRow
          label={anchorComplete ? 'set' : 'pending'}
          color={anchorComplete ? tokens.commune : tokens.textDim}
          dot={anchorComplete}
        />
      </Section>

      <Section label="Hub">
        <DensityBar score={density.score} tier={density.tier} />
        <div style={{ marginTop: 6, fontSize: tokens.fontSizeXs, color: tokens.textDim }}>
          {density.totalEntries} entries · {density.activeDays} days
        </div>
      </Section>

      <Section label="Identity">
        <div style={{ fontSize: tokens.fontSizeSm, color: tokens.text }}>
          {state.identity.name}
        </div>
        <div style={{ marginTop: 4, fontSize: tokens.fontSizeXs, color: tokens.textDim }}>
          streak {state.identity.streak}
        </div>
        <div style={{ marginTop: 4, fontSize: tokens.fontSizeXs, color: tokens.accent }}>
          corruption {((state.identity as any).corruption ?? 100.0).toFixed(3)}%
        </div>
      </Section>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SearchAltar onTeleport={onTeleport} />

        {onOpenDesktopWorld && (
          <PanelButton
            label="[Desktop World]"
            accent={tokens.accent}
            onClick={onOpenDesktopWorld}
          />
        )}

        <PanelButton
          label="[Mind Map]"
          accent={tokens.reflect}
          onClick={onOpenMindMap}
        />

        <PanelButton
          label="[Synaptic Vault]"
          accent={tokens.commune}
          onClick={onOpenSynapticVault}
        />
        
        <PanelButton
          label="[Data Cartridge]"
          accent={tokens.midday}
          onClick={onOpenFloppy}
        />

        <div style={{ marginTop: 8, fontSize: '9px', fontStyle: 'italic', color: tokens.textDim, opacity: 0.6, textAlign: 'center', lineHeight: '1.4' }}>
          "I understand you through the fractal eye."
        </div>
      </div>
    </aside>
  );
}

function PanelButton({ label, accent, onClick }: { label: string; accent: string; onClick: () => void }) {
  return (
    <button
          onClick={onClick}
          style={{
            padding: '10px',
            background: 'transparent',
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            color: tokens.textDim,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fontSizeXs,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = accent;
            e.currentTarget.style.color = tokens.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = tokens.border;
            e.currentTarget.style.color = tokens.textDim;
          }}
        >
          {label}
        </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: tokens.fontSizeXs,
          color: tokens.textDim,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function StatusRow({ label, color, dot }: { label: string; color: string; dot: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dot ? color : 'transparent',
          border: `1px solid ${color}`,
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: tokens.fontSizeSm, color, letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}

function DensityBar({ score, tier }: { score: number; tier: string }) {
  const color = TIER_COLORS[tier] ?? tokens.textMuted;
  const pct = Math.round(score * 100);

  return (
    <div>
      <div
        style={{
          height: 4,
          background: tokens.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ marginTop: 4, fontSize: tokens.fontSizeXs, color, letterSpacing: '0.06em' }}>
        {tier} · {pct}%
      </div>
    </div>
  );
}
