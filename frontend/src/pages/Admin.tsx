import { useEffect, useState } from "react";
import { api, type AdminUser, type Role, type VersionInfo, type Settings } from "../api";
import { useAuth } from "../auth";

export function Admin() {
  const { user: me } = useAuth();
  const [version, setVersion] = useState<VersionInfo>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState<string>();
  const [msg, setMsg] = useState<string>();

  // New-user form
  const [nu, setNu] = useState({ email: "", password: "", name: "", role: "USER" as Role });

  async function load() {
    try {
      const [v, u, s] = await Promise.all([api.version(), api.listUsers(), api.getSettings()]);
      setVersion(v);
      setUsers(u.users);
      setSettings(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setMsg(undefined);
    try {
      await api.createUser(nu);
      setMsg(`Created ${nu.email}`);
      setNu({ email: "", password: "", name: "", role: "USER" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleRole(u: AdminUser) {
    try {
      await api.updateUser(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleActive(u: AdminUser) {
    try {
      await api.updateUser(u.id, { active: !u.active });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.email}?`)) return;
    try {
      await api.deleteUser(u.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setError(undefined);
    setMsg(undefined);
    try {
      const s = await api.updateSettings({
        feePercent: settings.feePercent,
        perOrderFee: settings.perOrderFee,
        shippingCost: settings.shippingCost,
        shippingCharged: settings.shippingCharged,
      });
      setSettings(s);
      setMsg("Fees & shipping saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Admin</h2>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="card">
        <h3>Version &amp; build</h3>
        {version ? (
          <div className="kv">
            <span className="k">Version</span>
            <span className="mono">{version.version}</span>
            <span className="k">Build (git sha)</span>
            <span className="mono">{version.buildSha}</span>
            <span className="k">Build time</span>
            <span className="mono">{version.buildTime || "—"}</span>
            <span className="k">Environment</span>
            <span className="mono">{version.nodeEnv}</span>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>

      {settings && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>Fees &amp; shipping</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Used by the profit calculator on each comic.
          </p>
          <div className="row">
            <div className="col">
              <label>eBay fee %</label>
              <input
                type="number"
                step="0.01"
                value={settings.feePercent}
                onChange={(e) => setSettings({ ...settings, feePercent: Number(e.target.value) })}
              />
            </div>
            <div className="col">
              <label>Per-order fee ($)</label>
              <input
                type="number"
                step="0.01"
                value={settings.perOrderFee}
                onChange={(e) => setSettings({ ...settings, perOrderFee: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <label>Your shipping cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={settings.shippingCost}
                onChange={(e) => setSettings({ ...settings, shippingCost: Number(e.target.value) })}
              />
            </div>
            <div className="col">
              <label>Shipping charged to buyer ($)</label>
              <input
                type="number"
                step="0.01"
                value={settings.shippingCharged}
                onChange={(e) => setSettings({ ...settings, shippingCharged: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="spacer" />
          <button onClick={saveSettings}>Save fees</button>
        </div>
      )}

      <div className="card">
        <h3>Users</h3>
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td>
                  <span className={`badge ${u.role === "ADMIN" ? "accent" : ""}`}>{u.role}</span>
                </td>
                <td>
                  <span className={`badge ${u.active ? "good" : "bad"}`}>
                    {u.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="muted">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}
                </td>
                <td className="right">
                  <button className="secondary" onClick={() => toggleRole(u)} disabled={u.id === me?.id}>
                    {u.role === "ADMIN" ? "Make user" : "Make admin"}
                  </button>
                  <button className="secondary" onClick={() => toggleActive(u)} disabled={u.id === me?.id}>
                    {u.active ? "Disable" : "Enable"}
                  </button>
                  <button className="danger" onClick={() => remove(u)} disabled={u.id === me?.id}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h3>Add a user</h3>
        <form onSubmit={createUser}>
          <div className="row">
            <div className="col">
              <label>Email</label>
              <input
                type="email"
                value={nu.email}
                onChange={(e) => setNu({ ...nu, email: e.target.value })}
                required
              />
            </div>
            <div className="col">
              <label>Name</label>
              <input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="col">
              <label>Password (min 8)</label>
              <input
                type="password"
                value={nu.password}
                onChange={(e) => setNu({ ...nu, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div className="col" style={{ maxWidth: 160 }}>
              <label>Role</label>
              <select
                value={nu.role}
                onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="spacer" />
          <button type="submit">Create user</button>
        </form>
      </div>
    </div>
  );
}
