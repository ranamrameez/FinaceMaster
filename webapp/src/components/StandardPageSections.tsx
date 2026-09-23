import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageTopBarChips } from '../hooks/usePageTopBar';
import type { TopBarChip } from '../store/pageTopBarStore';
import { StandardCard, type StandardCardAction } from './StandardCard';

export interface StandardPageSection { key:string; label:string; content:ReactNode; summary?:ReactNode; actions?:StandardCardAction[]; headerEnd?:ReactNode; defaultOpen?:boolean; }

export function StandardPageSections({sections,defaultKey}:{sections:StandardPageSection[];defaultKey?:string}) {
  const [params,setParams]=useSearchParams();
  const firstKey=defaultKey||sections[0]?.key||'';
  const requested=params.get('section');
  const activeKey=requested&&sections.some(s=>s.key===requested)?requested:firstKey;
  const [openKeys,setOpenKeys]=useState<Record<string,boolean>>(()=>Object.fromEntries(sections.map(s=>[s.key,s.defaultOpen??s.key===activeKey])));
  const refs=useRef<Record<string,HTMLElement|null>>({});
  useEffect(()=>{if(activeKey)setOpenKeys(p=>({...p,[activeKey]:true}));},[activeKey]);
  const setSection=(key:string|null)=>{const next=new URLSearchParams(params); if(key)next.set('section',key); else next.delete('section'); setParams(next);};
  const jump=(key:string)=>{setOpenKeys(p=>({...p,[key]:true}));setSection(key);requestAnimationFrame(()=>refs.current[key]?.scrollIntoView({behavior:'smooth',block:'start'}));};
  const allOpen=sections.length>0&&sections.every(s=>openKeys[s.key]);
  const chips=useMemo<TopBarChip[]>(()=>[
    {key:'__all__',label:'All',active:requested==='all'||allOpen,onClick:()=>{setOpenKeys(Object.fromEntries(sections.map(s=>[s.key,true])));setSection('all');}},
    ...sections.map(s=>({key:s.key,label:s.label,active:activeKey===s.key,onClick:()=>jump(s.key)}))
  ],[sections,openKeys,activeKey,requested]);
  usePageTopBarChips(chips);
  return <div className="standard-section-stack">{sections.map(s=><div key={s.key} className="standard-section-anchor" ref={el=>{refs.current[s.key]=el;}}>
    <StandardCard title={s.label} summary={s.summary} actions={s.actions} headerEnd={s.headerEnd} open={!!openKeys[s.key]} onToggle={open=>{setOpenKeys(p=>({...p,[s.key]:open})); if(open)setSection(s.key); else if(activeKey===s.key)setSection(null);}}>{s.content}</StandardCard>
  </div>)}</div>;
}
