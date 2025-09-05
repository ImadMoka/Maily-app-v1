export const colors = {
  primary: '#9B9BBF',
  secondary: '#E6E6EF',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type ColorKey = keyof typeof colors;