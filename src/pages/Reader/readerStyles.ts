import literataNormal from "@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url";
import literataItalic from "@fontsource-variable/literata/files/literata-latin-wght-italic.woff2?url";
import newsreaderNormal from "@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2?url";
import newsreaderItalic from "@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2?url";
import interNormal from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import interItalic from "@fontsource-variable/inter/files/inter-latin-wght-italic.woff2?url";
import type { HighlightColor, ReaderFont, ReaderPreferences, ReaderTheme } from "@/types";

export const readerFontStacks: Record<ReaderFont, string> = {
  literata: '"Akshara Literata", "Literata Variable", Georgia, serif',
  newsreader: '"Akshara Newsreader", "Newsreader Variable", Georgia, serif',
  inter: '"Akshara Inter", "Inter Variable", ui-sans-serif, system-ui, sans-serif',
};

export const readerFontLabels: Record<ReaderFont, string> = {
  literata: "Literata",
  newsreader: "Newsreader",
  inter: "Inter",
};

export const readerThemeMeta: Record<
  ReaderTheme,
  { label: string; bg: string; fg: string; accent: string }
> = {
  light: { label: "Paper", bg: "#F7F5F0", fg: "#2A2621", accent: "#8A6D43" },
  sepia: { label: "Sepia", bg: "#F2E7D3", fg: "#3A2F22", accent: "#8A6535" },
  dark: { label: "Night", bg: "#17191B", fg: "#E9E5DD", accent: "#C6A978" },
};

export const highlightColors: Record<HighlightColor, { label: string; fill: string }> = {
  gold: { label: "Gold", fill: "#c8aa69" },
  sage: { label: "Sage", fill: "#7f9a74" },
  rose: { label: "Rose", fill: "#ba7d7d" },
  sky: { label: "Sky", fill: "#7c9ab8" },
};

const themeInk: Record<
  ReaderTheme,
  { bg: string; ink: string; soft: string; muted: string; line: string; accent: string }
> = {
  light: {
    bg: "#f7f5f0",
    ink: "#2a2621",
    soft: "#5c554b",
    muted: "#8b8174",
    line: "#ddd3c4",
    accent: "#8a6d43",
  },
  sepia: {
    bg: "#f2e7d3",
    ink: "#3a2f22",
    soft: "#6a5943",
    muted: "#8f7b61",
    line: "#d8c5a8",
    accent: "#8a6535",
  },
  dark: {
    bg: "#17191b",
    ink: "#e9e5dd",
    soft: "#bdb8ae",
    muted: "#918d85",
    line: "#32373b",
    accent: "#c6a978",
  },
};

const fontFaces = `
@font-face {
  font-family: "Akshara Literata";
  src: url("${literataNormal}") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Akshara Literata";
  src: url("${literataItalic}") format("woff2");
  font-weight: 200 900;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: "Akshara Newsreader";
  src: url("${newsreaderNormal}") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Akshara Newsreader";
  src: url("${newsreaderItalic}") format("woff2");
  font-weight: 200 900;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: "Akshara Inter";
  src: url("${interNormal}") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Akshara Inter";
  src: url("${interItalic}") format("woff2");
  font-weight: 200 900;
  font-style: italic;
  font-display: swap;
}
`;

export function epubContentCss(
  preferences: ReaderPreferences,
  theme: ReaderTheme,
): string {
  const colors = themeInk[theme];
  const margin = Math.round(10 + (preferences.margin - 1) * 20);

  return `${fontFaces}
html {
  background: ${colors.bg} !important;
  color-scheme: ${theme === "dark" ? "dark" : "light"};
}
body {
  background: ${colors.bg} !important;
  color: ${colors.ink} !important;
  font-family: ${readerFontStacks[preferences.fontFamily]} !important;
  font-size: ${preferences.fontSize}px !important;
  line-height: ${preferences.lineHeight} !important;
  font-weight: 400;
  letter-spacing: 0.002em;
  padding: 0 ${margin}px 36px !important;
  margin: 0 auto !important;
  max-width: 100%;
  box-sizing: border-box;
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
p, li, dd, dt, td, th, blockquote, figcaption {
  color: ${colors.ink} !important;
  line-height: ${preferences.lineHeight} !important;
}
p {
  margin: 0 0 0.85em !important;
  orphans: 2;
  widows: 2;
}
h1, h2, h3, h4, h5, h6 {
  font-family: ${readerFontStacks[preferences.fontFamily]} !important;
  color: ${colors.ink} !important;
  line-height: 1.25 !important;
  letter-spacing: -0.012em;
  margin: 1.1em 0 0.55em !important;
  font-weight: 640;
  page-break-after: avoid;
}
h1 { font-size: 1.7em !important; }
h2 { font-size: 1.36em !important; }
h3 { font-size: 1.16em !important; }
a {
  color: ${colors.accent} !important;
  text-decoration-color: ${colors.line};
  text-underline-offset: 2px;
}
blockquote {
  margin: 1.3em 0 !important;
  padding: 0 0 0 1em !important;
  border-left: 1px solid ${colors.line} !important;
  color: ${colors.soft} !important;
  font-style: italic;
}
hr {
  border: 0 !important;
  border-top: 1px solid ${colors.line} !important;
  margin: 1.7em 0 !important;
}
img {
  max-width: 100% !important;
  height: auto !important;
}
figure { margin: 1.4em 0 !important; }
figcaption {
  color: ${colors.muted} !important;
  font-size: 0.78em !important;
  text-align: center;
}
::selection {
  background: ${colors.accent}55;
  color: ${colors.ink};
}
.akshara-highlight {
  border-radius: 2px;
}
`;
}
