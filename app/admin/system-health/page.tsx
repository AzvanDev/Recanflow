import { StatusPill } from "@/components/admin/StatusPill";
import { getSystemHealthData } from "@/lib/admin/data";

export default async function AdminSystemHealthPage() {
  const items = await getSystemHealthData();

  return (
    <div>
      <h1 className="admin-page-title">System Health</h1>
      <p className="admin-page-subtitle">Status of core services. Demo health data.</p>

      <div className="health-grid">
        {items.map((item) => (
          <div className="health-card" key={item.name}>
            <div className="health-card-name">{item.name}</div>
            <StatusPill level={item.level} />
            <div className="health-card-detail">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
