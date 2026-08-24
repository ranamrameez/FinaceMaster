import type { CSSProperties } from 'react';

/** Shared stat-card color palette — originally introduced for QSE/PSX's
 * Dashboard (README item 76: `.stat-card`'s CSS already read a
 * `--card-hue` custom property, but nothing ever set it, so every card
 * rendered the same flat color). Extracted here once it started being
 * duplicated per-page (StockPage, then Cash/Bank/Personal Loans/EMI/
 * Funds/Rentals) rather than copy-pasted a fourth-plus time. */
export const HUES = ['#3d4b58', '#c9a227', '#34c77b', '#3b6bd6', '#8a97a3', '#e5484d', '#7b5cd6', '#2ea3a3'];

export const hueStyle = (hue: string): CSSProperties => ({ '--card-hue': hue } as CSSProperties);
