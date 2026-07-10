import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/admin", label: "System", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/fees", label: "Fees & shipping" },
  { to: "/admin/ebay", label: "eBay export" },
  { to: "/admin/ai", label: "AI" },
  { to: "/admin/gcd", label: "UPC data" },
];

export function AdminLayout() {
  return (
    <div>
      <h2>Admin</h2>
      <nav className="admin-tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
