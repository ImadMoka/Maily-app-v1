export const colors = {
  primary: '#000000',
  secondary: '#F5F5F5',
  background: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  separator: '#E0E0E0',
  white: '#FFFFFF',
  black: '#000000',
  notification: '#25D366',
} as const;

export type ColorKey = keyof typeof colors;