import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Validate kebab-case: lowercase alphanumeric segments separated by single hyphens */
export function isValidKebab(str: string): boolean {
  if (!str) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(str);
}

/** Force input to kebab-case characters only (lowercase, digits, hyphens) */
export function toKebabChars(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}
