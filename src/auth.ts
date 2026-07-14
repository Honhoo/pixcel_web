const AUTH_KEY = "vision-pixel-admin-auth";
const ADMIN_USERNAME = "huanghao";
const ADMIN_PASSWORD = "19930315";

export function isAdminAuthed() {
  return window.localStorage.getItem(AUTH_KEY) === "true";
}

export async function checkAdminSession() {
  try {
    const response = await fetch("/api/admin/session", { credentials: "include" });
    const ok = response.ok;
    if (ok) window.localStorage.setItem(AUTH_KEY, "true");
    else window.localStorage.removeItem(AUTH_KEY);
    return ok;
  } catch {
    return isAdminAuthed();
  }
}

export async function loginAdmin(username: string, password: string) {
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (response.ok) {
      window.localStorage.setItem(AUTH_KEY, "true");
      return true;
    }
  } catch {
    // Local fallback keeps the admin usable when only the Vite dev server is open.
  }

  const ok = username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
  if (ok) window.localStorage.setItem(AUTH_KEY, "true");
  return ok;
}

export function logoutAdmin() {
  window.localStorage.removeItem(AUTH_KEY);
  fetch("/api/admin/logout", { method: "POST", credentials: "include" }).catch(() => {});
}
