import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currentMonthRange, type PeriodPreset } from '../lib/dateRange';
export type TransactionDirectionFilter='all'|'in'|'out';
export type TransactionSourceFilter='all'|'manual'|'statement-import';
export interface TransactionPageFilters{period:PeriodPreset;fromDate:string;toDate:string;direction:TransactionDirectionFilter;category:string;source:TransactionSourceFilter;}
export function useUrlTransactionFilters(){
 const [params,setParams]=useSearchParams(); const defaults=useMemo(()=>currentMonthRange(),[]);
 const filters:TransactionPageFilters={period:(params.get('period') as PeriodPreset|null)??'1',fromDate:params.get('from')||defaults.startDate,toDate:params.get('to')||defaults.endDate,direction:(params.get('direction') as TransactionDirectionFilter|null)??'all',category:params.get('category')||'all',source:(params.get('source') as TransactionSourceFilter|null)??'all'};
 useEffect(()=>{if(params.has('from')&&params.has('to')&&params.has('period'))return;const next=new URLSearchParams(params);if(!next.has('from'))next.set('from',defaults.startDate);if(!next.has('to'))next.set('to',defaults.endDate);if(!next.has('period'))next.set('period','1');setParams(next,{replace:true});},[]);
 const setFilters=(patch:Partial<TransactionPageFilters>)=>{const v={...filters,...patch},next=new URLSearchParams(params);next.set('period',v.period);next.set('from',v.fromDate);next.set('to',v.toDate);v.direction==='all'?next.delete('direction'):next.set('direction',v.direction);v.category==='all'?next.delete('category'):next.set('category',v.category);v.source==='all'?next.delete('source'):next.set('source',v.source);setParams(next);};
 const resetFilters=()=>{const r=currentMonthRange();setFilters({period:'1',fromDate:r.startDate,toDate:r.endDate,direction:'all',category:'all',source:'all'});};
 const activeCount=(filters.period!=='1'?1:0)+(filters.direction!=='all'?1:0)+(filters.category!=='all'?1:0)+(filters.source!=='all'?1:0);
 return {filters,setFilters,resetFilters,activeCount};
}
