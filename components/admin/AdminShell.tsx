"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Cpu, Grip, HeartPulse, LayoutDashboard, Menu, Moon, Search, Settings as SettingsIcon, Sun, Users } from "lucide-react";
import { loadTheme, saveTheme, type Theme } from "@/lib/theme";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/research", label: "Research", icon: Search },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/ai-usage", label: "AI Usage", icon: Cpu },
  { href: "/admin/system-health", label: "System Health", icon: HeartPulse },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setTheme(loadTheme());
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    saveTheme(next);
  }

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <span className="admin-logo">
            <Grip size={14} />
          </span>
          <b>ReCan Flow</b>
          <span className="admin-badge">Admin</span>
        </div>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`admin-nav-item ${active ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle navigation">
            <Menu size={16} />
          </button>
          <div className="admin-topbar-spacer" />
          <button className="admin-theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
