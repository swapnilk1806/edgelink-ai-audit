"use client";

import { useEffect, useMemo, useState } from "react";
import { readApiResponse } from "@/lib/api-response";

type Recommendation={priority:string;category:string;finding:string;fix:string;estimated_impact:string;effort:string;falsifiability_check:string};
type Result={overall_score:number;score_breakdown:Record<string,number|null>;critical_issues:unknown[];important_issues:unknown[];quick_wins:unknown[];recommendations:Recommendation[];executive_summary:string};
type Audit={id:string;website_url:string;status:string;progress:number;error_message:string|null;created_at:string;result:Result|null;has_report:boolean};
const text=(value:unknown)=>typeof value==="string"?value:JSON.stringify(value);
export default function ClientDashboard(){
  const [audits,setAudits]=useState<Audit[]>([]);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    const load=async()=>{try{const response=await fetch("/api/client/audits");const data=await readApiResponse<Audit[]>(response);if(active){setAudits(data);setError("")}}catch(e){if(active)setError(e instanceof Error?e.message:"Request failed")}};
    void load();const timer=window.setInterval(()=>void load(),5000);return()=>{active=false;window.clearInterval(timer)};
  },[]);
  const completed=audits.filter(a=>a.result);
  const latest=completed[0];
  const history=useMemo(()=>completed.slice().reverse(),[completed]);
  const scorePoints=useMemo(()=>{
    if(history.length<2)return "";
    const min=Math.min(...history.map(a=>a.result!.overall_score));
    const max=Math.max(...history.map(a=>a.result!.overall_score));
    const span=Math.max(1,max-min);
    return history.map((audit,index)=>{
      const x=24+(index*(352/(history.length-1)));
      const y=12+(100-((audit.result!.overall_score-min)/span*100));
      return `${x},${y}`;
    }).join(" ");
  },[history]);
  return <>
    <div className="topline"><div><h1 className="page-title">Your SEO dashboard</h1><div className="subtle">A clear view of your organic search health. Scores use a consistent evidence-based rubric; unavailable measurements are not included.</div></div></div>
    {error&&<div className="notice">{error}</div>}
    {!audits.length?<section className="card"><h2 className="section-title">Your first audit is being prepared</h2><p className="subtle">Completed audits and recommendations will appear here.</p></section>:<>
      <section className="grid two-col" style={{marginBottom:18}}>
        <article className="card"><div className="metric-label">Latest SEO score</div>{latest?<><div className="audit-score">{latest.result!.overall_score}<span style={{fontSize:17,color:"#81909a"}}> / 100</span></div><p>{latest.result!.executive_summary}</p><div className="subtle">Audited {new Date(latest.created_at).toLocaleDateString()} · {latest.website_url}</div>{latest.has_report&&<a className="button" style={{display:"inline-block",marginTop:15}} href={`/api/reports/${latest.id}`}>Download PDF report</a>}</>:<p className="subtle">Your audit is in progress. This page refreshes automatically.</p>}</article>
        <article className="card"><h2 className="section-title">Category scores</h2>{latest?Object.entries(latest.result!.score_breakdown).map(([key,value])=><div key={key} style={{margin:"12px 0"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{textTransform:"capitalize"}}>{key.replaceAll("_"," ")}</span><strong>{typeof value==="number"?`${value}/100`:"Not measured"}</strong></div><div className="progress"><span style={{width:`${typeof value==="number"?value:0}%`}}/></div></div>):<p className="subtle">Scores will appear when analysis is complete.</p>}</article>
      </section>
      {latest&&<section className="grid two-col" style={{marginBottom:18}}>
        {([["Critical issues",latest.result!.critical_issues],["Important issues",latest.result!.important_issues],["Quick wins",latest.result!.quick_wins]] as [string,unknown[]][]).map(([title,items])=><article key={title} className="card"><h2 className="section-title">{title}</h2>{items.length?<ul className="issue-list">{items.map((item,index)=><li key={index}>{text(item)}</li>)}</ul>:<p className="subtle">No items reported.</p>}</article>)}
        <article className="card"><h2 className="section-title">Recommendations</h2>{latest.result!.recommendations.length?latest.result!.recommendations.map((item,index)=><div key={index} style={{padding:"12px 0",borderBottom:"1px solid #edf0f1"}}><div style={{display:"flex",justifyContent:"space-between",gap:10}}><strong>{item.category}</strong><span className="badge running">{item.priority}</span></div><p style={{margin:"8px 0"}}>{item.finding}</p><div className="subtle"><strong>Fix:</strong> {item.fix}</div><div className="subtle" style={{marginTop:5}}>Impact: {item.estimated_impact} · Effort: {item.effort}</div><div className="subtle" style={{marginTop:4}}>Verify: {item.falsifiability_check}</div></div>):<p className="subtle">No recommendations provided.</p>}</article>
      </section>}
      <section className="card"><h2 className="section-title">Audit history & score changes</h2>{!completed.length?<p className="subtle">Your audit history will show here.</p>:<>{history.length>1&&<div style={{margin:"0 0 15px",maxWidth:500}}><svg role="img" aria-label="SEO score trend over completed audits" viewBox="0 0 400 125" width="100%" height="125" preserveAspectRatio="none"><line x1="20" y1="112" x2="380" y2="112" stroke="#e4ebed"/><polyline points={scorePoints} fill="none" stroke="#1d7a68" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>{scorePoints.split(" ").map((point,index)=>{const [cx,cy]=point.split(",");return <circle key={index} cx={cx} cy={cy} r="4" fill="#1d7a68"/>})}</svg><div className="subtle">Score trend across completed audits</div></div>}<div className="table-wrap"><table><thead><tr><th>Date</th><th>Website</th><th>Score</th><th>Change</th><th>Report</th></tr></thead><tbody>{history.map((audit,index)=>{const prev=history[index-1]?.result?.overall_score;const change=prev===undefined?null:audit.result!.overall_score-prev;return <tr key={audit.id}><td>{new Date(audit.created_at).toLocaleDateString()}</td><td>{audit.website_url}</td><td>{audit.result!.overall_score}/100</td><td>{change===null?"—":`${change>0?"+":""}${change}`}</td><td>{audit.has_report?<a href={`/api/reports/${audit.id}`} className="button secondary">Download PDF</a>:"—"}</td></tr>})}</tbody></table></div></>}</section>
      <section style={{marginTop:18}}><h2 className="section-title">In progress</h2>{audits.filter(a=>a.status==="queued"||a.status==="running").map(a=><article className="card" key={a.id} style={{marginBottom:10}}>{a.website_url}<span className={`badge ${a.status}`} style={{marginLeft:12}}>{a.status}</span><div className="progress" style={{marginTop:10}}><span style={{width:`${a.progress}%`}}/></div><div className="subtle" style={{marginTop:5}}>{a.progress}% complete</div></article>)}</section>
    </>}
  </>;
}
