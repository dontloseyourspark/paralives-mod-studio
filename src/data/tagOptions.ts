export const TAG_OPTIONS = [
  'Living Room',
  'Dining Room',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Office',
  'Decor',
  'Seating',
] as const;

export type TagOption = typeof TAG_OPTIONS[number];
