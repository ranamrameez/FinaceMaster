import type { Plugin } from 'chart.js';
export function chartAlpha(color:string,alpha=.58):string{
 const hex=color.trim();
 if(/^#[0-9a-f]{6}$/i.test(hex)){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r}, ${g}, ${b}, ${alpha})`;}
 if(/^#[0-9a-f]{3}$/i.test(hex)){const r=parseInt(hex[1]+hex[1],16),g=parseInt(hex[2]+hex[2],16),b=parseInt(hex[3]+hex[3],16);return `rgba(${r}, ${g}, ${b}, ${alpha})`;}
 return color;
}
export const chartDepthPlugin:Plugin={id:'finance-recorder-depth',beforeDatasetDraw(chart){const ctx=chart.ctx;ctx.save();ctx.shadowColor='rgba(0,0,0,.22)';ctx.shadowBlur=10;ctx.shadowOffsetX=3;ctx.shadowOffsetY=5;},afterDatasetDraw(chart){chart.ctx.restore();}};
