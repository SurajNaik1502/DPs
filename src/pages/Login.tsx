import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../store/db";

export function Login() {
  const { user, login } = useStore();
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const msg = login(username, password);
    if (msg) setErr(msg);
    else nav("/");
  };

  return (
    <div className="login-wrap">
      <section className="login-story">
        <div>
          <div className="brand-mark">D</div>
          <h1>Cost every gram of the tiffin.</h1>
          <p>
            Item-level masters, purchase batches, sub-recipes and menu costing —
            built around Idli, Sambar and Coconut chutney as the working
            kitchen.
          </p>
        </div>
        <div className="login-chips">
          <span className="chip">Item master</span>
          <span className="chip">Unit conversion</span>
          <span className="chip">Sub recipe</span>
          <span className="chip">Per kg costing</span>
        </div>
      </section>
      <form className="login-card" onSubmit={onSubmit}>
        <h2>Sign in</h2>
        <p className="muted">
          User-wise authentication. Each role sees the kitchen they own.
        </p>
        {err && <p className="error">{err}</p>}
        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <div style={{ marginTop: 20 }}>
          <button className="btn" type="submit">
            Enter kitchen
          </button>
        </div>
        <div className="creds">
          <div>
            Admin: <code>admin / admin123</code>
          </div>
          <div>
            Kitchen: <code>kitchen / kitchen123</code>
          </div>
          <div>
            Purchase: <code>purchase / purchase123</code>
          </div>
        </div>
      </form>
    </div>
  );
}
