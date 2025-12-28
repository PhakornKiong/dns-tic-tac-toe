import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks if an error message indicates that a session has expired or not been found
 */
export function isSessionExpiredError(error: string | null | undefined): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('session not found') ||
    lowerError.includes('session expired') ||
    lowerError.includes('session does not exist')
  );
}

