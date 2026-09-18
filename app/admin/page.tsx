import { LineChart } from "@/components/admin/LineChart";
import { MiniTrendCard } from "@/components/admin/MiniTrendCard";
import { StatTile } from "@/components/admin/StatTile";
import { StatusPill } from "@/components/admin/StatusPill";
import { getOverviewData } from "@/lib/admin/data";

export default async function AdminOverviewPage() {
  const data = await getOverviewData();

  return (
    <div>
      <h1 className="admin-page-title">Overview</h1>
      <p className="admin-page-subtitle">Snapshot of ReCan Flow usage across users, product activity, and system health.</p>

      <div className="admin-section">
        <div className="kpi-grid">
          {data.kpis.map((metric) => (
            <StatTile key={metric.label} metric={metric} />
          ))}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-card">
          <h2 className="admin-card-title">Growth trend</h2>
          <p className="admin-card-subtitle">Total users, last 90 days</p>
          <LineChart data={data.growth} />
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Product usage</h2>
        <div className="mini-trend-grid">
          {data.productUsage.map((metric) => (
            <MiniTrendCard key={metric.key} metric={metric} />
          ))}
        </div>
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">System health</h2>
        <div className="health-grid">
          {data.systemHealth.map((item) => (
            <div className="health-card" key={item.name}>
              <div className="health-card-name">{item.name}</div>
              <StatusPill level={item.level} />
              <div className="health-card-detail">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
