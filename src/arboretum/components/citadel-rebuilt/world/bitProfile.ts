import type { AvatarConfig, WeaponStyle } from '../types';

export const DEFAULT_BIT_AVATAR: AvatarConfig = {
  glowColor: 0xa855f7, // Citadel signature purple
  silhouette: 'default',
  trailStyle: 'none',
  auraIntensity: 0.5,
  weapon: 'none',
};

type BitAvatarOverrides = Partial<AvatarConfig> & {
  weapon?: WeaponStyle;
};

export function resolveBitAvatar(
  _avatar?: AvatarConfig,
  overrides?: BitAvatarOverrides,
  glowColorFallback = DEFAULT_BIT_AVATAR.glowColor,
): AvatarConfig {
  // Wardrobe feature retired: player avatar locked to signature Citadel purple mode
  const base: AvatarConfig = {
    ...DEFAULT_BIT_AVATAR,
  };

  const merged: AvatarConfig = {
    ...base,
    ...(overrides || {}),
    glowColor: overrides?.glowColor ?? glowColorFallback ?? DEFAULT_BIT_AVATAR.glowColor,
  };

  if (!merged.weapon || merged.weapon === 'none') {
    merged.weapon = DEFAULT_BIT_AVATAR.weapon;
  }

  return merged;
}
