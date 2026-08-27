import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

// README Pending item 76: one worst-of-N sync-status indicator in the
// Sidebar. Tested directly (not through the full App/Sidebar tree) since
// it only renders once signed in — exercising it live needs a real
// Firebase account this project's own cloud-sync-safety rules forbid
// creating a throwaway one for (see CLAUDE.md).
describe('SyncStatusIndicator', () => {
  it('renders nothing when there are no modules', () => {
    const { container } = render(<SyncStatusIndicator modules={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Synced" when every module reports a healthy status', () => {
    render(
      <SyncStatusIndicator
        modules={[
          { name: 'Cash', status: 'Synced · 1/1/2026, 12:00:00 PM' },
          { name: 'Bank', status: 'Synced (uploaded local data)' },
        ]}
      />,
    );
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('surfaces the worst status across modules, not the first or last', () => {
    render(
      <SyncStatusIndicator
        modules={[
          { name: 'Cash', status: 'Synced · 1/1/2026, 12:00:00 PM' },
          { name: 'Bank', status: 'Sync error — check console' },
          { name: 'EMI', status: 'Syncing…' },
        ]}
      />,
    );
    // A real error anywhere outranks a merely-in-progress sync elsewhere.
    expect(screen.getByText('Sync issue')).toBeTruthy();
  });

  it('ranks syncing above a healthy module but below an error', () => {
    render(
      <SyncStatusIndicator
        modules={[
          { name: 'Cash', status: 'Synced · 1/1/2026, 12:00:00 PM' },
          { name: 'Bank', status: 'Syncing…' },
        ]}
      />,
    );
    expect(screen.getByText('Syncing…')).toBeTruthy();
  });

  it('opens a popover on click listing every module by name with its own status text', () => {
    render(
      <SyncStatusIndicator
        modules={[
          { name: 'Cash', status: 'Synced · 1/1/2026, 12:00:00 PM' },
          { name: 'Bank', status: 'Sync error — check console' },
        ]}
      />,
    );
    expect(screen.queryByText('Sync status by module')).toBeNull();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Sync status by module')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Bank')).toBeTruthy();
    expect(screen.getByText('Sync error — check console')).toBeTruthy();
  });
});
