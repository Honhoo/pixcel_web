const AUTH_KEY = "vision-pixel-admin-auth";
const ADMIN_USERNAME = "huanghao";
const ADMIN_PASSWORD = "19930315";

export function isAdminAuthed() {
  return window.localStorage.getItem(AUTH_KEY) === "true";
}

export function loginAdmin(username: string, password: string) {
  const ok = username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;
  if (ok) window.localStorage.setItem(AUTH_KEY, "true");
  return ok;
}

export function logoutAdmin() {
  window.localStorage.removeItem(AUTH_KEY);
}
