import React from 'react';
import { SynapticCalibrationChamber } from './coreCalibration/SynapticCalibrationChamber';

export function SynapticVaultModal({ onClose }: { onClose: () => void }) {
  return <SynapticCalibrationChamber onClose={onClose} />;
}