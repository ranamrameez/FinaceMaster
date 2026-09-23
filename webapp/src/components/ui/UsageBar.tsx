import type { CSSProperties } from 'react';
export function UsageBar({used,total,leftLabel,rightLabel}:{used:number;total:number;leftLabel:string;rightLabel:string;}){
 const pct=total>0?Math.min(100,Math.max(0,(used/total)*100)):0;
 return <div className="usage-bar"><div className="usage-bar-track"><div className="usage-bar-used" style={{'--usage-pct':`${pct}%`} as CSSProperties}/></div><div className="usage-bar-labels"><span className="text-loss">{leftLabel}</span><span className="text-profit">{rightLabel}</span></div></div>;
}
