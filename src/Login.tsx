import { FormEvent, useEffect, useState } from "react";
import { isAdminAuthed, loginAdmin } from "./auth";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdminAuthed()) window.location.href = "/admin";
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (await loginAdmin(username, password)) {
      window.location.href = "/admin";
      return;
    }
    setError("用户名或密码不正确");
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <a className="login-logo" href="/">
          <img src="/assets/brand/logo-white.png" alt="微境像素" />
        </a>
        <span>CASE CMS</span>
        <h1>后台登录</h1>
        <form onSubmit={onSubmit}>
          <label>
            用户名
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit">登录后台</button>
        </form>
        <a className="login-back" href="/">
          返回官网
        </a>
      </section>
    </main>
  );
}

export default Login;
