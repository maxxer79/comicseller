import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import { api, type VersionInfo } from "./api";
import { Login } from "./pages/Login";
import { Inventory } from "./pages/Inventory";
import { Intake } from "./pages/Intake";
import { ComicDetail } from "./pages/ComicDetail";
import { ImportCsv } from "./pages/ImportCsv";
import { Admin } from "./pages/Admin";

function Header({ version }: { version?: VersionInfo }) {
  const { user, logout } = useAuth();
  return (
    <header className="app-header">
      <span className="brand">📚 Comicseller</span>
      <nav>
        <NavLink to="/" end>
          Inventory
        </NavLink>
        <NavLink to="/intake">Add comic</NavLink>
        <NavLink to="/import">Import</NavLink>
        {user?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="header-right">
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
          <Route path="/intake" element={<Intake />} />
          <Route path="/import" element={<ImportCsv />} />
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
