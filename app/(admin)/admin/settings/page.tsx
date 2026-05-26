import { getAdminCommunitySettings } from "@/server/services/admin/community-settings";
import { updateAdminSettings } from "@/server/actions/admin-settings";

const FEATURE_KEYS = [
  "community_posts",
  "maintenance_requests",
  "architectural_requests",
  "vendor_proposals",
  "vendor_invoices",
  "pool_maintenance",
  "financial_approvals",
  "multi_hoa_mode",
];

const FEATURE_LABELS: Record<string, string> = {
  community_posts: "Community posts",
  maintenance_requests: "Maintenance requests",
  architectural_requests: "Architectural requests",
  vendor_proposals: "Vendor proposals",
  vendor_invoices: "Vendor invoices",
  pool_maintenance: "Pool maintenance",
  financial_approvals: "Financial approvals",
  multi_hoa_mode: "Multi-HOA mode",
};

export default async function AdminSettingsPage() {
  const result = await getAdminCommunitySettings();

  if (result.kind !== "settings") {
    return <div className="p-4">Settings are not available for your account.</div>;
  }

  const s = result.settings || {};
  const payment = s.payment || {};
  const branding = s.branding || {};
  const featureFlags = s.feature_flags || {};
  const fiscal = s.fiscal_year || {};

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-lg font-semibold">Community settings</h2>

      <form action={updateAdminSettings} className="grid gap-6">
        <input type="hidden" name="communitySlug" value={result.communitySlug} />

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Payment settings</h3>
          <label className="text-sm">Fee policy</label>
          <select name="feePolicy" defaultValue={payment.fee_policy || "payer_pays"} className="max-w-xs rounded-sm border px-2 py-1">
            <option value="payer_pays">Payer pays</option>
            <option value="hoa_pays">HOA pays</option>
            <option value="configurable">Configurable</option>
          </select>

          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="allowCard" defaultChecked={!!payment.allow_card} />
              <span className="text-sm">Allow card</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="allowAch" defaultChecked={!!payment.allow_ach} />
              <span className="text-sm">Allow ACH</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="guestPaymentsEnabled" defaultChecked={!!payment.guest_payments_enabled} />
              <span className="text-sm">Guest payments</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" name="manualPaymentsEnabled" defaultChecked={!!payment.manual_payments_enabled} />
              <span className="text-sm">Manual payments</span>
            </label>
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Branding</h3>
          <label className="text-sm">Public display name</label>
          <input name="publicDisplayName" defaultValue={branding.public_display_name || result.communitySlug} className="max-w-xl rounded-sm border px-2 py-1" />

          <label className="text-sm">Logo URL</label>
          <input name="logoUrl" defaultValue={branding.logo_url || ""} className="max-w-xl rounded-sm border px-2 py-1" />

          <div className="flex gap-4">
            <div>
              <label className="text-sm">Primary color</label>
              <input name="primaryColor" defaultValue={branding.primary_color || ""} className="rounded-sm border px-2 py-1" />
            </div>
            <div>
              <label className="text-sm">Secondary color</label>
              <input name="secondaryColor" defaultValue={branding.secondary_color || ""} className="rounded-sm border px-2 py-1" />
            </div>
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Feature flags</h3>
          <div className="grid gap-2">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input type="checkbox" name={`feature_${key}`} defaultChecked={!!featureFlags[key]} />
                <span className="text-sm">{FEATURE_LABELS[key] || key.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Compliance defaults</h3>
          <label className="text-sm">Delinquent days past due</label>
          <input type="number" name="delinquentDaysPastDue" defaultValue={s.delinquent_days_past_due ?? 15} className="max-w-xs rounded-sm border px-2 py-1" />

          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="messageNotificationsEnabled" defaultChecked={!!s.message_notifications_enabled} />
            <span className="text-sm">Message notifications enabled</span>
          </label>

          <label className="text-sm">Message retention days</label>
          <input type="number" name="messageRetentionDays" defaultValue={s.message_retention_days ?? 2555} className="max-w-xs rounded-sm border px-2 py-1" />
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">Fiscal year</h3>
          <div className="flex gap-4 items-end">
            <div>
              <label className="text-sm">Start month</label>
              <input type="number" name="fiscalYearStartMonth" defaultValue={fiscal.start_month ?? 1} min={1} max={12} className="w-24 rounded-sm border px-2 py-1" />
            </div>
            <div>
              <label className="text-sm">Start day</label>
              <input type="number" name="fiscalYearStartDay" defaultValue={fiscal.start_day ?? 1} min={1} max={31} className="w-24 rounded-sm border px-2 py-1" />
            </div>
            <div>
              <label className="text-sm">End month</label>
              <input type="number" name="fiscalYearEndMonth" defaultValue={fiscal.end_month ?? 12} min={1} max={12} className="w-24 rounded-sm border px-2 py-1" />
            </div>
            <div>
              <label className="text-sm">End day</label>
              <input type="number" name="fiscalYearEndDay" defaultValue={fiscal.end_day ?? 31} min={1} max={31} className="w-24 rounded-sm border px-2 py-1" />
            </div>
          </div>
        </section>

        <div className="pt-4">
          <button type="submit" className="rounded-sm bg-[var(--accent)] px-3 py-1 text-white">Save settings</button>
        </div>
      </form>
    </div>
  );
}
