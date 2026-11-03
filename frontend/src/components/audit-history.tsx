"use client";

import { useEffect, useState } from "react";
import { readApiResponse } from "@/lib/api-response";

type Audit = { id:string; client_name:string; website_url:string; status:string; progress:number; created_at:string; error_message:string|null; overall_score:string|null };
export default function AuditHistory() {
  const [audits,setAudits]=useState<Audit[]>([]);
  const [error,setError]=useState("");
  const [retryingId,setRetryingId]=useState<string|null>(null);
  async function load(){
    const response=await fetch("/api/admin/audits");
    setAudits(await readApiResponse<Audit[]>(response));
  }
  async function retryAudit(id:string){
    setRetryingId(id);
    setError("");
    try{
      const response=await fetch(`/api/admin/audits/${encodeURIComponent(id)}/retry`,{method:"POST"});
      await readApiResponse(response);
      await load();
    }catch(e){
      setError(e instanceof Error?e.message:"Unable to retry audit");
    }finally{
      setRetryingId(null);
    }
  }
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{try{await load();if(active)setError("")}catch(e){if(active)setError(e instanceof Error?e.message:"Request failed")}};
    void refresh(); const timer=window.setInterval(()=>void refresh(),5000);
    return()=>{active=false;window.clearInterval(timer)};
  },[]);
  return <>
    <div className="topline"><div><h1 className="page-title">Audit history</h1><div className="subtle">Audit statuses and report access update automatically. Scores use a consistent evidence-based rubric.</div></div><a className="button" href="/admin">Start an audit</a></div>
    {error&&<div className="notice">{error}</div>}
    <section className="card"><h2 className="section-title">All audits</h2>
      {!audits.length?<p className="subtle">No audits yet.</p>:<div className="table-wrap"><table><thead><tr><th>Client</th><th>Website</th><th>Created</th><th>Status</th><th>Progress</th><th>Score</th><th>Report</th><th>Action</th></tr></thead><tbody>{audits.map(a=><tr key={a.id}><td>{a.client_name}</td><td>{a.website_url}</td><td>{new Date(a.created_at).toLocaleString()}</td><td><span className={`badge ${a.status}`}>{a.status}</span>{a.error_message&&<div className="subtle" style={{color:"#aa4035",whiteSpace:"normal"}}>{a.error_message}</div>}</td><td><div className="progress"><span style={{width:`${a.progress}%`}}/></div>{a.progress}%</td><td>{a.overall_score??"—"}</td><td>{a.status==="completed"?<a className="button secondary" href={`/api/reports/${a.id}`}>Download PDF</a>:"—"}</td><td>{a.status==="failed"?<button className="button secondary" type="button" disabled={retryingId!==null} onClick={()=>void retryAudit(a.id)}>{retryingId===a.id?"Retrying…":"Retry"}</button>:"—"}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
