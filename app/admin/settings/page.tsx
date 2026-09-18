import { getSettingsData } from "@/lib/admin/data";

export default async function AdminSettingsPage() {
  const providers = await getSettingsData();

  return (
    <div>
      <h1 className="admin-page-title">Settings</h1>
      <p className="admin-page-subtitle">Admin panel configuration.</p>

      <div className="admin-section">
        <div className="admin-card">
          <h2 className="admin-card-title">Appearance</h2>
          <p className="admin-card-subtitle">Light and dark theme follow the toggle in the top bar, defaulting to your system preference.</p>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-card">
          <h2 className="admin-card-title">Data source</h2>
          <p className="admin-card-subtitle">
            This dashboard currently reads seeded synthetic data from <code>lib/admin/data.ts</code>. Every metric is structured so it can be
            swapped for a real database query later without changing any page.
          </p>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-card">
          <h2 className="admin-card-title">Provider configuration</h2>
          <p className="admin-card-subtitle">Configuration status only — API keys are never displayed.</p>
          <div>
            {providers.map((p) => (
              <div className="settings-row" key={p.name}>
                <div>
                  <div className="settings-row-name">{p.name}</div>
                  <div className="settings-row-env">{p.envVar}</div>
                </div>
                <span
                  className="status-pill"
                  style={{
                    color: p.configured ? "var(--success-text)" : "var(--text-3)",
                    background: p.configured ? "var(--success-bg)" : "var(--bg-neutral)",
                  }}
                >
                  {p.configured ? "Configured" : "Not configured"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
