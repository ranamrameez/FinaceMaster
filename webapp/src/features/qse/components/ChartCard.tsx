import type { ReactNode } from 'react';
import { Card } from '../../../components/Card';

export function ChartCard({ title, empty, children }: { title: string; empty?: boolean; children: ReactNode }) {
  return (
    <Card>
      <h4 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h4>
      {empty ? <p className="footer-note">Not enough data yet.</p> : children}
    </Card>
  );
}
