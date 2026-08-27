import { CollapsibleCard } from '../../../components/Card';
import { PlanningTab as CashPlanningTab } from '../../cash/pages/CashPage';
import { PlanningTab as BankPlanningTab } from '../../bank/pages/BankPage';

/** Promotes the Cash/Banking "Planning" feature to its own top-level page
 * (README Pending item 93: "Plans should be part of the main nav, not
 * buried inside each module's own tab set"), the same
 * precedent Transfers already set (README Done item 100): a real
 * `CategoryNav` entry that unifies cross-module content in one place
 * instead of scattering it across each module's own tab set. Reuses each
 * module's existing `PlanningTab` component unchanged (now exported from
 * `CashPage.tsx`/`BankPage.tsx`) — no parallel implementation, and each
 * module's own "Planning" tab is left in place too (this adds a second way
 * to reach it, doesn't remove the first). */
export function PlanningPage({
  cashPlannedSyncStatus,
  cashPlannedCloudEmpty,
  uploadCashPlannedLocalToCloud,
  bankPlannedSyncStatus,
  bankPlannedCloudEmpty,
  uploadBankPlannedLocalToCloud,
}: {
  cashPlannedSyncStatus: string;
  cashPlannedCloudEmpty: boolean;
  uploadCashPlannedLocalToCloud: () => Promise<void>;
  bankPlannedSyncStatus: string;
  bankPlannedCloudEmpty: boolean;
  uploadBankPlannedLocalToCloud: () => Promise<void>;
}) {
  return (
    <div>
      <h1 className="pagetitle">Planning</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Plan upcoming Cash and Banking activity ahead of time — a planned entry projects your real vs. planned
        balance until you mark it done, which converts it into a real entry. Still reachable from each module's own
        "Planning" tab too; this page brings both together in one place.
      </p>
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Cash</h3>} style={{ marginBottom: 16 }}>
        <CashPlanningTab
          plannedSyncStatus={cashPlannedSyncStatus}
          plannedCloudEmpty={cashPlannedCloudEmpty}
          uploadPlannedLocalToCloud={uploadCashPlannedLocalToCloud}
        />
      </CollapsibleCard>
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Banking</h3>}>
        <BankPlanningTab
          plannedSyncStatus={bankPlannedSyncStatus}
          plannedCloudEmpty={bankPlannedCloudEmpty}
          uploadPlannedLocalToCloud={uploadBankPlannedLocalToCloud}
        />
      </CollapsibleCard>
    </div>
  );
}
