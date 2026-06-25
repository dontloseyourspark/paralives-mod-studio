// src/lib/itemValidation.ts
//
// Pre-export readiness checks for a single Item. Pure — no React, no store.
// v1 scope matches the documented "Mod validation" roadmap item: GUID precision
// loss, missing prefab, unset DisplayName, SwatchGroup mismatch.

import type { ComponentNode, Item, PrefabPropertyValue } from '../types/types'
import { getMeshNodes } from './itemTextureSlots'

export type ItemValidationStatus = 'ready' | 'warning' | 'error'

export interface ItemValidationResult {
  status: ItemValidationStatus
  issues: string[]
}

function hasPrecisionLoss(value: PrefabPropertyValue): boolean {
  if (typeof value === 'number') return Math.abs(value) >= 1e15
  if (Array.isArray(value)) return false
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(v => v !== undefined && hasPrecisionLoss(v))
  }
  return false
}

function findGuidPrecisionLoss(components: ComponentNode[]): string | null {
  for (const node of components) {
    for (const [key, value] of Object.entries(node.properties)) {
      if (hasPrecisionLoss(value)) return `GUID precision loss in ${node.type}.${key}`
    }
  }
  return null
}

export function validateItem(item: Item): ItemValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const meshNodes = getMeshNodes(item.components)
  const hasRoot = meshNodes.some(n => n.childIndex === undefined)
  if (!hasRoot) errors.push('Missing prefab root')

  const precisionIssue = findGuidPrecisionLoss(item.components)
  if (precisionIssue) errors.push(precisionIssue)

  if (!item.name?.trim()) warnings.push('Display name is empty')

  if (item.hasSwatches && !item.swatchGroup?.trim()) {
    warnings.push('Has Swatches is on but no Swatch Group GUID is set')
  }
  if (!item.hasSwatches && item.swatchGroup?.trim()) {
    warnings.push('Swatch Group GUID is set but Has Swatches is off')
  }

  const issues = [...errors, ...warnings]
  const status: ItemValidationStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ready'

  return { status, issues }
}
