import { DataTable } from "@/components/admin/DataTable";
import { StatusPill } from "@/components/admin/StatusPill";
import { getActivityData } from "@/lib/admin/data";
import type { ActivityStatus, HealthLevel } from "@/lib/admin/types";

const STATUS_LEVEL: Record<ActivityStatus, HealthLevel> = { success: "good", pending: "warning", failed: "critical" };

export default async function AdminActivityPage() {
  const activity = await getActivityData();

  return (
    <div>
      <h1 className="admin-page-title">Activity</h1>
      <p className="admin-page-subtitle">Recent example activity across the workspace — synthetic data, fictional users and topics.</p>

      <div className="admin-card">
        <DataTable
          columns={[
            { key: "user", label: "User" },
            { key: "action", label: "Action" },
            { key: "topic", label: "Topic" },
            { key: "timestamp", label: "Time", align: "right" },
            { key: "status", label: "Status", align: "right" },
          ]}
          rows={activity.map((a) => ({
            user: a.user,
            action: a.action,
            topic: a.topic,
            timestamp: a.timestamp,
            status: <StatusPill level={STATUS_LEVEL[a.status]} label={a.status[0].toUpperCase() + a.status.slice(1)} />,
          }))}
        />
      </div>
    </div>
  );
}
