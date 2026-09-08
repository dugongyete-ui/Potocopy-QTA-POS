/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#27383e',
    tint: '#df5d2f',
    background: '#f8f4ee',
    foreground: '#27383e',
    card: '#fffdf9',
    cardForeground: '#27383e',
    primary: '#df5d2f',
    primaryForeground: '#fffdf9',
    secondary: '#d7ece8',
    secondaryForeground: '#2b5c60',
    muted: '#eee8df',
    mutedForeground: '#6d7b7d',
    accent: '#e9c766',
    accentForeground: '#4b3f22',
    destructive: '#ca4038',
    destructiveForeground: '#fffdf9',
    border: '#dfd6ca',
    input: '#e8dfd4',
  },
  dark: {
    text: '#f5eee4',
    tint: '#eb7347',
    background: '#16282d',
    foreground: '#f5eee4',
    card: '#1d3439',
    cardForeground: '#f5eee4',
    primary: '#eb7347',
    primaryForeground: '#16282d',
    secondary: '#2e464b',
    secondaryForeground: '#f5eee4',
    muted: '#263e43',
    mutedForeground: '#b9aaa0',
    accent: '#d7ae4c',
    accentForeground: '#16282d',
    destructive: '#df5d55',
    destructiveForeground: '#f5eee4',
    border: '#345056',
    input: '#2a4449',
  },
  radius: 10,
};

export default colors;
