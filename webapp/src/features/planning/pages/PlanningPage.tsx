import { CollapsibleCard } from '../../../components/Card';
import { UpcomingList } from '../../../components/UpcomingList';
import { useUpcomingItems } from '../../../hooks/useUpcomingItems';
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
 * to reach it, doesn't remove the first).
 *
 * **Revamped 2026-09-07** (README Done item 238, Pending item 118): the
 * user called the whole feature "redundant, confusing and complex
 * looking" while it still failed to plan a recurring salary/utility bill
 * — this page now LEADS with the full `collectUpcomingItems()` list (every
 * module: Cash/Bank plans — including the new recurring ones — plus EMI's
 * next installment, Rentals' next rent collection, and Subscriptions'
 * next renewal), so "what's coming up" is answered in one glance instead
 * of digging through two separate per-module sections. The Cash/Banking
 * "manage everything" sections stay below, unchanged, for adding/editing/
 * deleting a plan — EMI/Rentals/Subscriptions keep their own native pages
 * for that (this page only surfaces what they already generate, read-only,
 * via the shared list above, rather than duplicating their own working
 * generators). */
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
  const upcoming = useUpcomingItems(30);

  return (
    <div>
      <h1 className="pagetitle">Planning</h1>
      <p className="footer-note" style={{ marginBottom: 12 }}>
        Everything expected to happen soon, across every module — a plan can now repeat (e.g.
        a monthly salary or a recurring bill), so you only set it up once. Cash and Banking's
        own "Add/edit a plan" tools are still below; EMI/Rentals/Subscriptions keep their own
        pages for that — this just brings what they already expect into one place too.
      </p>
      <CollapsibleCard title={<h3 style={{ margin: 0 }}>Upcoming (next 30 days)</h3>} style={{ marginBottom: 16 }}>
        <UpcomingList items={upcoming} emptyText="Nothing expected in the next 30 days." />
      </CollapsibleCard>
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
