import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Route, Routes, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { api, type VersionInfo } from "./api";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Labels } from "./pages/Labels";
import { Sales } from "./pages/Sales";
import { Cook } from "./pages/Cook";
import { Inventory } from "./pages/Inventory";
import { Intake } from "./pages/Intake";
import { RapidIntake } from "./pages/RapidIntake";
import { ComicDetail } from "./pages/ComicDetail";
import { ImportCsv } from "./pages/ImportCsv";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { SystemAdmin } from "./pages/admin/SystemAdmin";
import { UsersAdmin } from "./pages/admin/UsersAdmin";
import { FeesAdmin } from "./pages/admin/FeesAdmin";
import { EbayAdmin } from "./pages/admin/EbayAdmin";

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
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/?q=${encodeURIComponent(term)}` : "/");
    setMenuOpen(false);
  }

  return (
    <header className="app-header">
      <Link className="brand-link" to="/" onClick={() => setMenuOpen(false)}>
        <span className="brand">📚 Comicseller</span>
      </Link>
      <button
        className="nav-toggle"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      <form className="header-search" onSubmit={submitSearch} role="search">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search comics…"
          aria-label="Search comics"
        />
      </form>
      <nav className={menuOpen ? "app-nav open" : "app-nav"} onClick={() => setMenuOpen(false)}>
        <NavLink to="/" end>
          Inventory
        </NavLink>
        <NavLink to="/dashboard">Dashboard</NavLink>
        <NavLink to="/intake" end>Add comic</NavLink>
        <NavLink to="/intake/rapid">Rapid add</NavLink>
        <NavLink to="/import">Import</NavLink>
        <NavLink to="/cook">Let it cook</NavLink>
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
          <Route path="/intake/rapid" element={<RapidIntake />} />
          <Route path="/import" element={<ImportCsv />} />
          <Route path="/labels" element={<Labels />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/cook" element={<Cook />} />
          <Route path="/comics/:id" element={<ComicDetail />} />
          <Route
            path="/admin"
            element={user.role === "ADMIN" ? <AdminLayout /> : <Navigate to="/" replace />}
          >
            <Route index element={<SystemAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="fees" element={<FeesAdmin />} />
            <Route path="ebay" element={<EbayAdmin />} />
          </Route>
          <Route path="*" element={<p>Not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
