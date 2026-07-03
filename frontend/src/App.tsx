import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate, Link } from "react-router-dom";
import { useAuth } from "./auth";
import { api, type VersionInfo } from "./api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Labels } from "./pages/Labels";
import { Sales } from "./pages/Sales";
import { Inventory } from "./pages/Inventory";
import { Intake } from "./pages/Intake";
import { ComicDetail } from "./pages/ComicDetail";
import { ImportCsv } from "./pages/ImportCsv";
import { Admin } from "./pages/Admin";

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(
    () => document.documentElement.dataset.theme || "light"
  );
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("comicseller.theme", next);
    setTheme(next);
  }
  return [theme, toggle];
}

function Header({ version }: { version?: VersionInfo }) {
  const { user, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  return (
    <header className="app-header">
      <Link className="brand-link" to="/">
        <span className="brand">📚 Comicseller</span>
      </Link>
      <nav>
        <NavLink to="/" end>
          Inventory
        </NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/intake">Add comic</NavLink>
        <NavLink to="/import">Import</NavLink>
        <NavLink to="/labels">Labels</NavLink>
        <NavLink to="/sales">Sales</NavLink>
        {user?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="header-right">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        {version && <span className="version-chip">v{version.version}</span>}
        <span className="header-user">{user?.name || user?.email}</span>
        <button className="secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}

export function App() {
  const { user, loading } = useAuth();
  const [version, setVersion] = useState<VersionInfo>();

  useEffect(() => {
    api.version().then(setVersion).catch(() => undefined);
  }, []);

  if (loading) {
    return (
      <div className="login-wrap">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <>
      <Header version={version} />
      <main className="container">
        <Routes>
          <Route path="/" element={<Inventory />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/intake" element={<Intake />} />
          <Route path="/import" element={<ImportCsv />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/comics/:id" element={<ComicDetail />} />
          <Route
            path="/admin"
            element={user.role === "ADMIN" ? <Admin /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<p>Not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
