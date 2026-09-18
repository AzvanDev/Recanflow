import { BarChart } from "@/components/admin/BarChart";
import { DataTable } from "@/components/admin/DataTable";
import { StatTile } from "@/components/admin/StatTile";
import { getResearchData } from "@/lib/admin/data";

export default async function AdminResearchPage() {
  const data = await getResearchData();

  return (
    <div>
      <h1 className="admin-page-title">Research</h1>
      <p className="admin-page-subtitle">What people are researching, and which research tools they use.</p>

      <div className="admin-section">
        <div className="kpi-grid">
          <StatTile metric={data.sourceSearches} />
          <StatTile metric={data.documentsProcessed} />
        </div>
      </div>

      <div className="admin-section admin-grid cols-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Most researched topics</h2>
          <BarChart orientation="horizontal" data={data.topics} />
        </div>
        <div className="admin-card">
          <h2 className="admin-card-title">Most-used research features</h2>
          <BarChart orientation="horizontal" data={data.features} />
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-card">
          <h2 className="admin-card-title">Recent research sessions</h2>
          <DataTable
            columns={[
              { key: "topic", label: "Topic" },
              { key: "user", label: "User" },
              { key: "items", label: "Items", align: "right" },
              { key: "startedAt", label: "Started", align: "right" },
            ]}
            rows={data.sessions.map((s) => ({ topic: s.topic, user: s.user, items: s.items, startedAt: s.startedAt }))}
          />
        </div>
      </div>
    </div>
  );
}
