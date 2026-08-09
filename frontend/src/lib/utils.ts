// frontend/src/lib/utils.ts
//
// Standard shadcn/ui utility - required by virtually every component in
// src/components/ui/ (button.tsx, badge.tsx, avatar.tsx, accordion.tsx,
// alert-dialog.tsx, etc.). This file was missing after the Figma import,
// which caused every shadcn component's `import { cn } from "@/lib/utils"`
// to fail at build time - the most likely cause of the blank/broken page.

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
