export function getTerminalTheme(isDark: boolean) {
  return {
    background: isDark ? "#0A0A0C" : "#FFFFFF",
    foreground: isDark ? "#FFFFFF" : "#000000",
    cursor: isDark ? "#CCFF00" : "#FF3300",
    cursorAccent: isDark ? "#000000" : "#FFFFFF",
    selectionBackground: isDark ? "#CCFF0033" : "#FF330033",
    black: isDark ? "#0A0A0C" : "#000000",
    red: "#FF3300",
    green: "#CCFF00",
    yellow: "#FFD700",
    blue: "#0055FF",
    magenta: "#FF00FF",
    cyan: "#00FFFF",
    white: isDark ? "#FFFFFF" : "#F0F0EB",
    brightBlack: "#55555A",
    brightRed: "#FF6633",
    brightGreen: "#D4FF33",
    brightYellow: "#FFEA00",
    brightBlue: "#3377FF",
    brightMagenta: "#FF33FF",
    brightCyan: "#33FFFF",
    brightWhite: "#FFFFFF",
  };
}

export function getRuntimeThemePatch(isDark: boolean) {
  return {
    background: isDark ? "#0A0A0C" : "#FFFFFF",
    foreground: isDark ? "#FFFFFF" : "#000000",
    cursor: isDark ? "#CCFF00" : "#FF3300",
    cursorAccent: isDark ? "#000000" : "#FFFFFF",
    selectionBackground: isDark ? "#CCFF0033" : "#FF330033",
    black: isDark ? "#0A0A0C" : "#000000",
    red: "#FF3300",
    green: "#CCFF00",
    white: isDark ? "#FFFFFF" : "#F0F0EB",
    brightBlack: "#55555A",
  };
}

export const TERMINAL_FONT_FAMILY =
  '"JetBrainsMono Nerd Font", "JetBrainsMonoNL Nerd Font", var(--font-mono), "JetBrains Mono", monospace';
