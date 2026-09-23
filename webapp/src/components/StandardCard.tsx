import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MenuIcon } from './icons';

export interface StandardCardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

export function SummaryChip({ label, value }: { label?: string; value: ReactNode }) {
  return <span className="summary-chip">{label && <span className="summary-chip-label">{label}</span>}<span className="summary-chip-value">{value}</span></span>;
}

function CardActionMenu({ actions }: { actions: StandardCardAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!actions.length) return null;
  return <div className="standard-card-menu" ref={rootRef}>
    <button type="button" className="standard-card-menu-trigger" aria-label="Card options" aria-expanded={open} onClick={(e)=>{e.stopPropagation();setOpen(v=>!v);}}><MenuIcon size={16}/></button>
    {open && <div className="standard-card-menu-popover" role="menu">{actions.map(a=><button key={a.label} type="button" className={`standard-card-menu-item${a.tone==='danger'?' danger':''}`} disabled={a.disabled} onClick={()=>{setOpen(false);a.onClick();}}>{a.label}</button>)}</div>}
  </div>;
}

export function StandardCard({ title, summary, actions=[], headerEnd, defaultOpen=true, open:controlledOpen, onToggle, children, className='' }: {
  title:string; summary?:ReactNode; actions?:StandardCardAction[]; headerEnd?:ReactNode; defaultOpen?:boolean; open?:boolean; onToggle?:(open:boolean)=>void; children:ReactNode; className?:string;
}) {
  const [internalOpen,setInternalOpen]=useState(defaultOpen);
  const open=controlledOpen??internalOpen;
  const toggle=()=>{const next=!open; if(onToggle)onToggle(next); else setInternalOpen(next);};
  return <section className={`card standard-card ${className}`.trim()}>
    <header className="standard-card-header">
      <button type="button" className="standard-card-toggle" aria-expanded={open} onClick={toggle}><span className={`standard-card-arrow${open?' open':''}`} aria-hidden>▸</span><span className="standard-card-title">{title}</span></button>
      <div className="standard-card-summary">{summary}</div>
      <div className="standard-card-actions" onClick={e=>e.stopPropagation()}>{headerEnd}<CardActionMenu actions={actions}/></div>
    </header>
    {open && <div className="standard-card-body">{children}</div>}
  </section>;
}
