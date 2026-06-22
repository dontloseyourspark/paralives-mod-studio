// src/data/workshopTags.ts
//
// Steam Workshop publishing tags for Paralives mods — these describe the mod's
// content for the Workshop listing page (filtering/discovery on Steam), and are
// entirely separate from the in-game build-mode catalog tags in itemTextureSlots.ts
// (BUILD_MODE_TAG_GUIDS), which control where an item appears in the in-game
// catalog and are referenced by numeric GUID, not by name.
//
// "Old Tags" are legacy categories from before Steam Workshop reorganized this
// tag set — kept here since existing mods may already carry them, but they're
// not meaningful choices for a new upload.

export interface WorkshopTagCategory {
  id: string
  label: string
  tags: string[]
}

export const WORKSHOP_TAG_CATEGORIES: WorkshopTagCategory[] = [
  {
    id: 'build_mode',
    label: 'Build Mode',
    tags: [
      'Build Mode', 'Furniture', 'Table', 'Seating', 'Bed', 'Appliance', 'Electronic',
      'Lighting', 'Hobby', 'Baby/Toddler', 'Kid', 'Decor', 'Clutter', 'Door', 'Window',
      'Architectural', 'Nature', 'Wall/Flooring',
    ],
  },
  {
    id: 'paramaker',
    label: 'Paramaker',
    tags: [
      'Paramaker', 'Hairstyle', 'Facial Hair', 'Facial Detail', 'Facial Preset', 'Body',
      'Headwear', 'Top', 'Bottoms', 'Overall', 'Shoes', 'Makeup', 'Accessory', 'Skin',
      'Skin Detail', 'Tattoo', 'Pattern', 'Shader',
    ],
  },
  {
    id: 'live_mode',
    label: 'Live Mode',
    tags: [
      'Live Mode', 'Personality', 'Interaction', 'Animation', 'Autonomy', 'Occupation',
      'Together Card', 'Story Card', 'Storyteller', 'Goal', 'Need', 'Want', 'Emotion',
      'Skill', 'Cooking Recipe', 'Status Effect', 'Newspaper', 'Mail', 'Collectible',
    ],
  },
  {
    id: 'general',
    label: 'General',
    tags: ['Translation', 'Interface', 'Camera', 'Misc'],
  },
  {
    id: 'household',
    label: 'Household',
    tags: ['Household', 'Single Parafolk', 'Couple', 'Friend', 'Family'],
  },
  {
    id: 'lots',
    label: 'Lots',
    tags: ['Lot', 'House', 'Apartment', 'Shop', 'Restaurant', 'Park', 'Unique'],
  },
  {
    id: 'old_tags',
    label: 'Old Tags (legacy)',
    tags: ['Modpacks', 'Households', 'Houses'],
  },
]

export const MAX_WORKSHOP_TAGS = 5
