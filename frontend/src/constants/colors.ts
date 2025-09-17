export const colors = {
  primary: '#25D366',
  secondary: '#F7F8FA',
  background: '#FFFFFF',
  text: '#000000',
  textSecondary: '#667781',
  separator: '#E9EDEF',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorKey = keyof typeof colors;