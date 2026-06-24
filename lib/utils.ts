import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString("en", options ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatTime(date: Date | string) {
  return new Date(date).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
}

export function getDuration(start: Date | string, end: Date | string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.round((diff % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function fullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}
