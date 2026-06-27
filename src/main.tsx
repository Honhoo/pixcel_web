import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Admin from "./Admin";
import App from "./App";
import Login from "./Login";
import "./styles.css";

const enableLocalAdmin = import.meta.env.DEV;

const Root = enableLocalAdmin
  ? window.location.pathname.startsWith("/admin")
    ? Admin
    : window.location.pathname.startsWith("/login")
      ? Login
      : App
  : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
