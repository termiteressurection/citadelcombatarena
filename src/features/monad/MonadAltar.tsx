import React from 'react';
import { WelcomeLandingScreen } from './WelcomeLandingScreen';

interface Props {
  onInscribe?: (anchor: string, reflection: string) => void;
  onEnterWorld?: () => void;
  onSkipToWorld?: () => void;
  defaultAnchor?: string;
  onOpenSynapticVault?: () => void;
  onOpenGatewayAudio?: () => void;
  onOpenMindMap?: () => void;
  onFactoryReset?: () => void;
}

export function MonadAltar({
  onEnterWorld,
  onSkipToWorld,
}: Props) {
  return (
    <WelcomeLandingScreen
      onEnterWorld={onSkipToWorld || onEnterWorld || (() => {})}
    />
  );
}
