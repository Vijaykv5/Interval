"use client";

export type AuthIntentRole = "creator" | "user";

const AUTH_INTENT_STORAGE_KEY = "interval-auth-intent";

export function getAuthIntent(): AuthIntentRole | null {
  if (typeof window === "undefined") return null;

  const value = window.sessionStorage.getItem(AUTH_INTENT_STORAGE_KEY);
  return value === "creator" || value === "user" ? value : null;
}

export function setAuthIntent(role: AuthIntentRole) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_INTENT_STORAGE_KEY, role);
}

export function clearAuthIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_INTENT_STORAGE_KEY);
}
