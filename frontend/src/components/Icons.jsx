// frontend/src/components/Icons.jsx
// Restored - deleted by the Figma import commit but still required by
// ReportView.jsx's `import { ... } from "./Icons"`. Inert today since
// nothing currently imports ReportView, but required once we wire it
// back into the app router below.

import React from "react";

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

export const IconBolt = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M11 2 4 11h5l-1 7 7-9h-5l1-7z" /></svg>);
export const IconFolder = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M2.5 5.5a1 1 0 0 1 1-1H8l1.5 2h7a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9.5z" /></svg>);
export const IconBulb = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M10 2.5a5 5 0 0 0-3 9v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a5 5 0 0 0-3-9z" /><path d="M8.5 17h3" /></svg>);
export const IconChart = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M3 17V9" /><path d="M9 17V4" /><path d="M15 17v-6" /><path d="M2.5 17h15" /></svg>);
export const IconFile = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M6 2.5h6l3.5 3.5v10a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-12.5a1 1 0 0 1 1-1z" /><path d="M12 2.5V6h3.5" /></svg>);
export const IconSettings = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><circle cx="10" cy="10" r="2.6" /><path d="M10 2.8v2M10 15.2v2M17.2 10h-2M4.8 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3 4.9 4.9" /></svg>);
export const IconShield = (p) => (<svg viewBox="0 0 20 20" width={p.size || 18} height={p.size || 18} {...base}><path d="M10 2.5 16 5v5.2c0 4-3 6.6-6 7.3-3-.7-6-3.3-6-7.3V5l6-2.5z" /><path d="M7.3 10 9.3 12 12.8 8" /></svg>);
export const IconAlert = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M10 2.5 18 16H2L10 2.5z" /><path d="M10 8v3.5" /><circle cx="10" cy="14" r="0.4" fill="currentColor" stroke="none" /></svg>);
export const IconLock = (p) => (<svg viewBox="0 0 20 20" width={p.size || 13} height={p.size || 13} {...base}><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" /></svg>);
export const IconCheck = (p) => (<svg viewBox="0 0 20 20" width={p.size || 14} height={p.size || 14} {...base}><circle cx="10" cy="10" r="7.3" /><path d="M6.8 10.2 9 12.5l4.2-5" /></svg>);
export const IconShare = (p) => (<svg viewBox="0 0 20 20" width={p.size || 15} height={p.size || 15} {...base}><circle cx="15" cy="5" r="2" /><circle cx="5" cy="10" r="2" /><circle cx="15" cy="15" r="2" /><path d="M6.7 9 13.3 5.9M6.7 11 13.3 14.1" /></svg>);
export const IconDownload = (p) => (<svg viewBox="0 0 20 20" width={p.size || 15} height={p.size || 15} {...base}><path d="M10 3v9.5" /><path d="M6.3 9.3 10 13l3.7-3.7" /><path d="M3.5 16.5h13" /></svg>);
export const IconSparkle = (p) => (<svg viewBox="0 0 20 20" width={p.size || 15} height={p.size || 15} {...base}><path d="M10 2.5 11.4 7 16 8.4 11.4 9.8 10 14.3 8.6 9.8 4 8.4 8.6 7 10 2.5z" /></svg>);
export const IconMessage = (p) => (<svg viewBox="0 0 20 20" width={p.size || 15} height={p.size || 15} {...base}><path d="M3 4.5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3.2V14.5H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" /></svg>);
export const IconLink = (p) => (<svg viewBox="0 0 20 20" width={p.size || 12} height={p.size || 12} {...base}><path d="M8.5 11.5 11.5 8.5" /><path d="M9.3 6.6l1-1a2.7 2.7 0 0 1 3.8 3.8l-1 1M10.7 13.4l-1 1a2.7 2.7 0 0 1-3.8-3.8l1-1" /></svg>);
export const IconChevron = (p) => (<svg viewBox="0 0 20 20" width={p.size || 14} height={p.size || 14} style={{ transform: p.direction === "up" ? "rotate(180deg)" : "none" }} {...base}><path d="M5.5 8 10 12.5 14.5 8" /></svg>);
export const IconLayers = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><path d="M10 2.5 17 6.5 10 10.5 3 6.5 10 2.5z" /><path d="M3 10.5 10 14.5 17 10.5" /><path d="M3 14 10 18 17 14" /></svg>);
export const IconGem = (p) => (<svg viewBox="0 0 20 20" width={p.size || 15} height={p.size || 15} {...base}><path d="M5 4h10l3 4.5L10 18 2 8.5 5 4z" /><path d="M2 8.5h16M8 4l2 14M12 4 10 18" /></svg>);
export const IconCompare = (p) => (<svg viewBox="0 0 20 20" width={p.size || 15} height={p.size || 15} {...base}><path d="M6 2.5v15M14 2.5v15" /><path d="M3 6.5h6M3 13.5h6M11 6.5h6M11 13.5h6" /></svg>);
export const IconTarget = (p) => (<svg viewBox="0 0 20 20" width={p.size || 16} height={p.size || 16} {...base}><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3.6" /><circle cx="10" cy="10" r="0.6" fill="currentColor" stroke="none" /></svg>);
