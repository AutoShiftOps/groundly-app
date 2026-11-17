import type { SavedProject } from "../types/groundly";

const STORAGE_KEY = "groundly_projects_v2";

// Previously seeded 3 fully-fabricated demo companies (from
// data/demoReports.ts, now deleted) into localStorage on first load or
// on any parse failure, with no "demo" label shown anywhere in the UI --
// every first-time user saw fake saved analyses indistinguishable from
// real ones. Projects now always starts from real data only: an empty
// list until the user completes a real analysis.
export function loadProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProject(project: SavedProject): SavedProject[] {
  const current = loadProjects();
  const next = [
    project,
    ...current.filter((p) => p.id !== project.id),
  ].slice(0, 24);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues gracefully
  }
  return next;
}

export function deleteProject(projectId: string): SavedProject[] {
  const current = loadProjects();
  const next = current.filter((p) => p.id !== projectId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function relativeTime(ts: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
