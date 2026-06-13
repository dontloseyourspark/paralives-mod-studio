// src/types/surfaceModTypes.ts

export type ColorZoneCount = 0 | 1 | 2 | 3;
export type BuildModeTagName = string;

export interface SwatchColor {
  guid: string;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface SwatchEntry {
  guid: string;
  colors: SwatchColor[];
}

export interface SurfaceTextureAsset {
  cacheKey: string;
  filename: string;
  checksum: string;
  gameVersion: string;
  guid: string;
}

export interface SurfaceMod {
  internalName: string;
  displayName: string;
  creatorId: string;
  modGuid: string;
  buildModeTags: [string, string];
  swatchThumbnailType: number;
  texture: SurfaceTextureAsset | null;
  colorZoneMap: SurfaceTextureAsset | null;
  normalAoMap: SurfaceTextureAsset | null;
  smoothnessMap: SurfaceTextureAsset | null;
  tilingX: number;
  tilingY: number;
  smoothnessValue: number;
  ambientOcclusionStrength: number;
  metallicValue: number;
  emissiveStrength: number;
  variantStrength: number;
  hueShift: number;
  alphaClip: number;
  grayMaskPureWhiteIsPureWhite: boolean;
  isWallOrFloor: boolean;
  wallYStretching: boolean;
  topBorder: number | null;
  bottomBorder: number | null;
  leftBorder: number | null;
  rightBorder: number | null;
  colorZoneCount: ColorZoneCount;
  colorZoneNameGuids: string[];
  swatches: SwatchEntry[];
  updatedAt?: string;
}

export const SURFACE_TAG_PRESETS: Record<string, [string, string]> = {
  'Wall Paint': ['WallSurfaces', 'Paint'],
  'Wall Wallpaper': ['WallSurfaces', 'Wallpaper'],
  'Wall Brick': ['WallSurfaces', 'Brick'],
  'Wall Tile': ['WallSurfaces', 'Tile'],
  'Floor Wood': ['FloorSurfaces', 'Wood'],
  'Floor Tile': ['FloorSurfaces', 'Tile'],
  'Floor Carpet': ['FloorSurfaces', 'Carpet'],
};

// Generates a random 19-digit numerical GUID used natively by Paralives
export function generatePGuid(): string {
  return (Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000).toString();
}

// Fallback constant to satisfy imports
export const GAME_ASSET_GUID = {
  empty: '0'
};