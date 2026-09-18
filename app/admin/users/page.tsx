import { BarChart } from "@/components/admin/BarChart";
import { RangeLineChart } from "@/components/admin/RangeLineChart";
import { StatTile } from "@/components/admin/StatTile";
import { getUsersData } from "@/lib/admin/data";

export default async function AdminUsersPage() {
  const data = await getUsersData();
  const last14Signups = data.newSignups90d.slice(-14);

  return (
    <div>
      <h1 className="admin-page-title">Users</h1>
      <p className="admin-page-subtitle">Growth, activity, and signups across the user base.</p>

      <div className="admin-section">
        <div className="kpi-grid">
          {data.stats.map((metric) => (
            <StatTile key={metric.label} metric={metric} />
          ))}
        </div>
      </div>

      <div className="admin-section admin-grid cols-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Growth trend</h2>
          <p className="admin-card-subtitle">Total users over time</p>
          <RangeLineChart data={data.growth90d} />
        </div>
        <div className="admin-card">
          <h2 className="admin-card-title">New signups</h2>
          <p className="admin-card-subtitle">Daily, last 14 days</p>
          <BarChart data={last14Signups.map((p) => ({ label: p.date, value: p.value }))} height={200} />
        </div>
      </div>
    </div>
  );
}
