import React, { lazy } from 'react';

export type FeatureId = 
  | 'inscribe' 
  | 'terminal' 
  | 'termite'
  | 'bottle'
  | 'constellation' 
  | 'search' 
  | 'heatmap' 
  | 'skybox' 
  | 'graph' 
  | 'mbti'
  | 'chrono_dial'
  | 'notebook'
  | 'mindmap'
  | 'archive'
  | 'altar';

export interface FeatureDefinition {
  id: FeatureId;
  label: string;
  icon: 'triangle' | 'circle' | 'square' | 'cross' | 'options' | 'share';
  component: React.LazyExoticComponent<any>;
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  altar: {
    id: 'altar',
    label: 'Journal Altar (Living Crucible)',
    icon: 'triangle',
    component: lazy(() => import('./JournalAltarModal')),
  },
  inscribe: {
    id: 'inscribe',
    label: 'Inscribe',
    icon: 'triangle',
    component: lazy(() => import('./InscribeOverlay')),
  },
  terminal: {
    id: 'terminal',
    label: 'Chamber Terminal',
    icon: 'options',
    component: lazy(() => import('./ChamberTerminal')),
  },
  termite: {
    id: 'termite',
    label: 'Termite',
    icon: 'circle',
    component: lazy(() => import('./TermiteDialog')),
  },
  bottle: {
    id: 'bottle',
    label: 'Bottle Post',
    icon: 'share',
    component: lazy(() => import('./BottlePostOverlay')),
  },
  constellation: {
    id: 'constellation',
    label: 'Constellation Map',
    icon: 'share',
    component: lazy(() => import('./ConstellationMap')),
  },
  search: {
    id: 'search',
    label: 'Archive Monolith & Search',
    icon: 'square',
    component: lazy(() => import('./ArchiveMonolithModal')),
  },
  archive: {
    id: 'archive',
    label: 'Archive Monolith',
    icon: 'square',
    component: lazy(() => import('./ArchiveMonolithModal')),
  },
  heatmap: {
    id: 'heatmap',
    label: 'Mood Heatmap',
    icon: 'square',
    component: lazy(() => import('./MoodHeatmap')),
  },
  skybox: {
    id: 'skybox',
    label: 'Skybox Painter',
    icon: 'square',
    component: lazy(() => import('./SkyboxPainter')),
  },
  graph: {
    id: 'graph',
    label: 'Mind Map',
    icon: 'share',
    component: lazy(() => import('./ConstellationMap')), // Reuses constellation
  },

  mbti: {
    id: 'mbti',
    label: 'MBTI Calibration',
    icon: 'triangle',
    component: lazy(() => import('./MBTICalibrationOverlay')),
  },
  chrono_dial: {
    id: 'chrono_dial',
    label: 'Temporal Chrono-Dial',
    icon: 'options',
    component: lazy(() => import('./ChronoDialFeature')),
  },
  notebook: {
    id: 'notebook',
    label: 'Forensic Notebook',
    icon: 'options',
    component: lazy(() => import('./ForensicNotebook')),
  },
  mindmap: {
    id: 'mindmap',
    label: 'Global Mind Map',
    icon: 'options',
    component: lazy(() => import('../../../features/world/mindmap3d/MindmapShell').then(m => ({ default: m.MindmapShell }))),
  },
};
