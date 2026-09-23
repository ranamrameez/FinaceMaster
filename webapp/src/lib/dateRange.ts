export type PeriodPreset = '1' | '3' | '6' | '12' | 'ytd' | 'custom';
function dateKey(year:number,monthIndex:number,day:number){return `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
export function firstDayOfMonth(year:number,monthIndex:number){return dateKey(year,monthIndex,1);}
export function lastDayOfMonth(year:number,monthIndex:number){return dateKey(year,monthIndex,new Date(year,monthIndex+1,0).getDate());}
export function presetDateRange(preset:PeriodPreset,fromMonth='',toMonth='',asOf=new Date()){
  const year=asOf.getFullYear(), month=asOf.getMonth();
  if(preset==='custom'){const fallback=`${year}-${String(month+1).padStart(2,'0')}`;const s=fromMonth||toMonth||fallback,e=toMonth||fromMonth||fallback;const [sy,sm]=s.split('-').map(Number),[ey,em]=e.split('-').map(Number);return {startDate:firstDayOfMonth(sy,sm-1),endDate:lastDayOfMonth(ey,em-1)};}
  if(preset==='ytd') return {startDate:firstDayOfMonth(year,0),endDate:lastDayOfMonth(year,month)};
  const months=Number(preset), start=new Date(year,month-(months-1),1);
  return {startDate:firstDayOfMonth(start.getFullYear(),start.getMonth()),endDate:lastDayOfMonth(year,month)};
}
export function currentMonthRange(asOf=new Date()){return presetDateRange('1','','',asOf);}
