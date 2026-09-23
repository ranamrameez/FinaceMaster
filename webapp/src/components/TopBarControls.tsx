import type { ReactNode, SelectHTMLAttributes } from 'react';
export function TopBarControls({children}:{children:ReactNode}){return <div className="topbar-controls">{children}</div>;}
export function TopBarSelect({label,options,...rest}:{label:string;options:Array<{value:string;label:string}>}&Omit<SelectHTMLAttributes<HTMLSelectElement>,'children'>){
  return <label className="topbar-select-wrap"><span className="sr-only">{label}</span><select className="topbar-select" aria-label={label} {...rest}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}
