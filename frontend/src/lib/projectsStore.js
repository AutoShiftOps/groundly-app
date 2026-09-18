// frontend/src/lib/projectsStore.js
//
// GitHub visual-port task (Projects/Insights/Market/Reports pages):
// these pages need real historical data to show something other than
// an empty state after the very first analysis, and this app currently
// persists nothing -- App.tsx holds a single in-memory `report`, gone
// on refresh. Matches aurelo-ui's own actual mechanism (zustand's
// `persist` middleware, itself backed by localStorage) rather than
// inventing a different approach: every REAL completed /api/analyze
// response gets saved here, in the user's own browser, as it happens.
// Nothing here is fabricated -- it's just real reports the user
// generated, kept around instead of thrown away.
const STORAGE_KEY = "groundly_projects_v1";
const MAX_PROJECTS = 24;

function uid() {
  return `prj_${Math.random().toString(36).slice(2, 10)}`;
}

// localStorage can throw (private browsing, quota, disabled storage) --
// every call here degrades to "no history" rather than crashing the
// screen that called it.
export function loadProjects() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProject(idea, report) {
  try {
    const existing = loadProjects();
    const project = { id: uid(), idea, report, createdAt: Date.now() };
    const next = [project, ...existing].slice(0, MAX_PROJECTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return project;
  } catch {
    return null;
  }
}

export function clearProjects() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to do -- already effectively empty from the app's perspective
  }
}

// "2 hours ago" -- real elapsed time from a real createdAt timestamp,
// not a fabricated label. Hand-rolled rather than a new date-formatting
// dependency for one small utility.
export function relativeTime(ms) {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  const diffYear = Math.round(diffMonth / 12);
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}
