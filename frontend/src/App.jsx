import { useEffect, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileWarning,
  LockKeyhole,
  Map,
  MapPinned,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import CitizenPage from "./pages/CitizenPage";
import AdminPage from "./pages/AdminPage";
import { login, registerAccount } from "./api";

const DEMO_CREDENTIALS = {
  citizen: { username: "demo.citizen", password: "Citizen@123" },
  admin: { username: "admin.demo", password: "Admin@123" },
};

function BrandMark() {
  return (
    <div className="auth-brand-mark" aria-hidden="true">
      <MapPinned size={23} strokeWidth={2.2} />
    </div>
  );
}

function AuthHero({ mode, onDemo }) {
  return (
    <section className="auth-hero">
      <div className="auth-grid-lines" />
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <header className="auth-hero-top">
        <div className="auth-brand-lockup">
          <BrandMark />
          <div>
            <div className="auth-brand-name">OneMap</div>
            <div className="auth-brand-subtitle">CivicWatch platform</div>
          </div>
        </div>
        <div className="auth-live-pill">
          <span /> Local civic operations
        </div>
      </header>

      <div className="auth-hero-content">
        <div className="auth-eyebrow">
          <Sparkles size={14} /> Smarter reporting. Faster response.
        </div>
        <h1>
          A city works better
          <span>when every issue has a place.</span>
        </h1>
        <p>
          OneMap connects citizens, municipal teams and local AI in one visual workspace for
          reporting, prioritising and resolving public infrastructure issues.
        </p>

        <div className="auth-hero-actions">
          <button type="button" className="auth-primary-link" onClick={onDemo}>
            Try the demo account <ArrowRight size={16} />
          </button>
          <div className="auth-secure-note">
            <LockKeyhole size={14} /> Password-protected accounts
          </div>
        </div>

        <div className="auth-feature-grid">
          <div className="auth-feature-card">
            <Map size={19} />
            <div>
              <strong>Map-first reporting</strong>
              <span>Pin the exact location of every issue.</span>
            </div>
          </div>
          <div className="auth-feature-card">
            <Sparkles size={19} />
            <div>
              <strong>Local AI analysis</strong>
              <span>Ollama helps classify and summarize reports.</span>
            </div>
          </div>
          <div className="auth-feature-card">
            <ShieldCheck size={19} />
            <div>
              <strong>Response workflow</strong>
              <span>Assign, track and resolve with accountability.</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="auth-hero-footer">
        <div><Users size={14} /> Citizen + municipal workspace</div>
        <div><FileWarning size={14} /> Reports remain traceable through resolution</div>
      </footer>
    </section>
  );
}

function AuthPanel({ initialMode = "login", onAuthenticated }) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState("citizen");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setError("");
    setMessage("");
  }, [mode, role]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    if (nextMode === "login") {
      setName("");
      setConfirmPassword("");
    }
  }

  function fillDemo() {
    const demo = DEMO_CREDENTIALS[role];
    setMode("login");
    setUsername(demo.username);
    setPassword(demo.password);
    setConfirmPassword("");
    setError("");
    setMessage(`Demo ${role === "admin" ? "administrator" : "citizen"} credentials filled in.`);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        const created = await registerAccount(
          name,
          username,
          password,
          role,
        );

        onAuthenticated(created);
        return;
      }

      const loggedIn = await login(username, password, role);
      onAuthenticated(loggedIn);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Welcome back" : "Create your account";
  const subtitle = mode === "login"
    ? "Sign in to your OneMap workspace."
    : "Start reporting and tracking civic issues in your area.";

  return (
    <section className="auth-panel-wrap">
      <div className="auth-panel">
        <div className="auth-panel-head">
          <div>
            <div className="auth-panel-kicker">{mode === "login" ? "SIGN IN" : "NEW ACCOUNT"}</div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="auth-panel-badge">
            {role === "admin" ? <ShieldCheck size={18} /> : <UserRound size={18} />}
          </div>
        </div>

        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "selected" : ""}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>

        <div className="auth-role-switch">
          <button
            type="button"
            className={role === "citizen" ? "selected" : ""}
            onClick={() => setRole("citizen")}
          >
            <UserRound size={16} />
            Citizen
          </button>
          <button
            type="button"
            className={role === "admin" ? "selected" : ""}
            onClick={() => setRole("admin")}
          >
            <ShieldCheck size={16} />
            Administrator
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              Full name
              <div className="auth-input-shell">
                <UserRound size={17} />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </div>
            </label>
          ) : null}

          <label>
            Username
            <div className="auth-input-shell">
              <Users size={17} />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. hrishikesh01"
                autoComplete="username"
                required
                minLength={3}
              />
            </div>
          </label>

          <label>
            Password
            <div className="auth-input-shell">
              <LockKeyhole size={17} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "register" ? 8 : 1}
              />
              <button
                type="button"
                className="auth-input-action"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {mode === "register" ? (
            <label>
              Confirm password
              <div className="auth-input-shell">
                <LockKeyhole size={17} />
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="auth-input-action"
                  onClick={() => setShowConfirm((value) => !value)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          ) : null}

          {mode === "register" ? (
            <div className="auth-password-note">
              Use at least 8 characters. For a hackathon build, this account is stored locally in SQLite.
            </div>
          ) : null}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            {!busy ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        {mode === "login" ? (
          <button type="button" className="demo-fill-button" onClick={fillDemo}>
            Use demo {role === "admin" ? "administrator" : "citizen"} account
          </button>
        ) : null}

        {message ? <div className="auth-message">{message}</div> : null}
        {error ? <div className="auth-error">{error}</div> : null}

        <div className="auth-panel-foot">
          <LockKeyhole size={13} />
          Authentication is local to this prototype. Production deployment should add secure sessions/JWT and stronger administrator controls.
        </div>
      </div>
    </section>
  );
}

function PublicFrontPage({ onAuthenticated }) {
  const [heroMode, setHeroMode] = useState("login");

  return (
    <main className="auth-page">
      <AuthHero
        mode={heroMode}
        onDemo={() => setHeroMode("login")}
      />
      <AuthPanel
        initialMode={heroMode}
        onAuthenticated={onAuthenticated}
      />
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("onemap_user") || "null");
    } catch {
      return null;
    }
  });

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
    localStorage.setItem("onemap_user", JSON.stringify(nextUser));
  }

  function logout() {
    localStorage.removeItem("onemap_user");
    setUser(null);
  }

  if (!user) {
    return <PublicFrontPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-root">
      {user.role === "citizen" ? <CitizenPage user={user} /> : <AdminPage user={user} />}
      <button type="button" className="floating-logout" onClick={logout} title="Sign out">
        <LockKeyhole size={16} />
        Sign out
      </button>
    </div>
  );
}
