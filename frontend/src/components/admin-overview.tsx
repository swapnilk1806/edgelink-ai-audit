"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiResponse } from "@/lib/api-response";

type Audit = { id: string; client_name: string; website_url: string; status: string; progress: number; created_at: string; error_message?: string; overall_score?: string };
type Dashboard = { metrics: { total_clients: number; total_audits: number; completed_audits: number; failed_audits: number; average_score: number | null }; recent: Audit[] };
type Client = { id: string; name: string; website_url: string };

export default function AdminOverview() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [overviewResponse, clientResponse] = await Promise.all([fetch("/api/admin/overview"), fetch("/api/admin/clients")]);
    const [overview, clientList] = await Promise.all([
      readApiResponse<Dashboard>(overviewResponse),
      readApiResponse<Client[]>(clientResponse)
    ]);
    setData(overview);
    setClients(clientList);
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { await load(); if (active) setError(""); }
      catch (e) { if (active) setError(e instanceof Error ? e.message : "Dashboard request failed"); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);

  async function startAudit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/admin/audits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: form.get("client_id"), website_url: form.get("website_url") }) });
      await readApiResponse<{ id: string }>(response);
      setMessage("Audit queued successfully. It will appear below as the worker processes it.");
      formElement.reset();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start audit"); }
    finally { setBusy(false); }
  }

  const metrics = data?.metrics;
  return <>
    <div className="topline"><div><h1 className="page-title">Operations overview</h1><div className="subtle">Monitor clients and SEO audit activity. Scores use a consistent evidence-based rubric.</div></div><a className="button" href="/admin/clients">Manage clients</a></div>
    {error && <div className="notice">{error}</div>}{message && <div className="notice success">{message}</div>}
    <section className="grid metrics">
      {[
        ["Total clients", metrics?.total_clients ?? "—"], ["Total audits", metrics?.total_audits ?? "—"],
        ["Completed", metrics?.completed_audits ?? "—"], ["Failed", metrics?.failed_audits ?? "—"],
        ["Average SEO score", metrics?.average_score == null ? "—" : `${metrics.average_score}/100`]
      ].map(([label, value]) => <article className="card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></article>)}
    </section>
    <section className="grid two-col">
      <article className="card">
        <h2 className="section-title">Recent audits</h2>
        {!data?.recent.length ? <p className="subtle">No audits yet. Queue an audit to get started.</p> : <div className="table-wrap"><table><thead><tr><th>Client / website</th><th>Status</th><th>Progress</th><th>Score</th></tr></thead><tbody>
          {data.recent.map((audit) => <tr key={audit.id}><td><strong>{audit.client_name}</strong><br/><span className="subtle">{audit.website_url}</span>{audit.error_message && <div className="subtle" style={{color:"#a84637",whiteSpace:"normal"}}>{audit.error_message}</div>}</td><td><span className={`badge ${audit.status}`}>{audit.status}</span></td><td><div className="progress"><span style={{width:`${audit.progress}%`}}/></div><small>{audit.progress}%</small></td><td>{audit.overall_score ?? "—"}</td></tr>)}
        </tbody></table></div>}
        <div style={{marginTop:16}}><a className="button secondary" href="/admin/audits">View audit history</a></div>
      </article>
      <article className="card">
        <h2 className="section-title">Start a new audit</h2>
        {!clients.length ? <p className="subtle">Create a client before starting an audit.</p> : <form onSubmit={startAudit}>
          <div className="field"><label htmlFor="client_id">Client</label><select className="select" id="client_id" name="client_id" required onChange={(event) => {
            const client = clients.find((item) => item.id === event.target.value);
            const url = document.getElementById("website_url") as HTMLInputElement | null;
            if (url && client) url.value = client.website_url;
          }}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <div className="field" style={{marginTop:14}}><label htmlFor="website_url">Website URL</label><input id="website_url" name="website_url" className="input" type="url" defaultValue={clients[0]?.website_url} required /></div>
          <button className="button" disabled={busy || !clients.length} style={{width:"100%",marginTop:16}}>{busy ? "Queueing audit..." : "Start SEO audit"}</button>
        </form>}
        <p className="subtle" style={{marginTop:18}}>Audit processing and progress refresh automatically every 5 seconds.</p>
      </article>
    </section>
  </>;
}
