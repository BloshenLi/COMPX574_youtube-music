export const musicSites = {
  Shazam: 'Shazam',
  Musixmatch: 'Musixmatch',
  Genius: 'Genius',
} as const;

export type MusicSite = (typeof musicSites)[keyof typeof musicSites];
