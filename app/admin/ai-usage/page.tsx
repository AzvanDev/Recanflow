import { BarChart } from "@/components/admin/BarChart";
import { Meter } from "@/components/admin/Meter";
import { StatTile } from "@/components/admin/StatTile";
import { StatusPill } from "@/components/admin/StatusPill";
import { getAiUsageData } from "@/lib/admin/data";

export default async function AdminAiUsagePage() {
  const data = await getAiUsageData();

  return (
    <div>
      <h1 className="admin-page-title">AI Usage</h1>
      <p className="admin-page-subtitle">Request volume, reliability, and provider health across Gemini, Groq, Tavily, and YouTube.</p>

      <div className="admin-section">
        <div className="kpi-grid">
          <StatTile metric={data.totalRequests} />
          <StatTile metric={data.successful} />
          <StatTile metric={data.failures} />
          <StatTile metric={data.avgResponseMs} />
        </div>
      </div>

      <div className="admin-section admin-grid cols-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Provider usage</h2>
          <p className="admin-card-subtitle">Share of AI requests by provider</p>
          <BarChart orientation="horizontal" data={data.providerUsage.map((p) => ({ label: p.name, value: p.requests, color: p.color }))} />
        </div>
        <div className="admin-card">
          <h2 className="admin-card-title">Provider status</h2>
          <p className="admin-card-subtitle">Quota and health per provider</p>
          <div>
            {data.providerStatus.map((p) => (
              <div className="provider-row" key={p.name}>
                <span className="provider-name">{p.name}</span>
                <StatusPill level={p.level} label={p.detail} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <Meter pct={data.geminiQuotaPct} label="Gemini daily free-tier quota" />
          </div>
        </div>
      </div>
    </div>
  );
}
