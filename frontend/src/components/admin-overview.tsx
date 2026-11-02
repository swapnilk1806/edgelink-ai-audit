"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  Globe2,
  Plus,
  RefreshCw,
  UsersRound
} from "lucide-react";
import { readApiResponse } from "@/lib/api-response";

type Audit = {
  id: string;
  client_name: string;
  website_url: string;
  status: string;
  progress: number;
  created_at: string;
  error_message?: string | null;
  overall_score?: number | string | null;
};

type Dashboard = {
  metrics: {
    total_clients: number;
    total_audits: number;
    completed_audits: number;
    failed_audits: number;
    average_score: number | null;
  };
  recent: Audit[];
};

type Client = { id: string; name: string; website_url: string };

function statusClass(status: string) {
  if (status === "completed" || status === "failed" || status === "running" || status === "queued") return status;
  return "";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default function AdminOverview() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    const [overviewResult, clientsResult] = await Promise.allSettled([
      fetch("/api/admin/overview", { signal }).then((response) => readApiResponse<Dashboard>(response)),
      fetch("/api/admin/clients", { signal }).then((response) => readApiResponse<Client[]>(response))
    ]);
    if (signal?.aborted) return;

    const failures: string[] = [];
    if (overviewResult.status === "fulfilled") {
      setData(overviewResult.value);
      setLastUpdated(new Date());
    } else {
      failures.push(overviewResult.reason instanceof Error ? overviewResult.reason.message : "Dashboard metrics request failed");
    }

    if (clientsResult.status === "fulfilled") {
      const clientList = clientsResult.value;
      setClients(clientList);
      setSelectedClientId((current) => current || clientList[0]?.id || "");
      setWebsiteUrl((current) => current || clientList[0]?.website_url || "");
    } else {
      failures.push(clientsResult.reason instanceof Error ? clientsResult.reason.message : "Client list request failed");
    }

    setError(failures.join(" "));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      void load(controller.signal);
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [load]);

  async function startAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/audits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: selectedClientId, website_url: websiteUrl.trim() })
      });
      await readApiResponse<{ id: string }>(response);
      setMessage("Audit queued. Its progress will update automatically.");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not start audit");
    } finally {
      setBusy(false);
    }
  }

  const metrics = data?.metrics;
  const completionRate = metrics && metrics.total_audits > 0
    ? Math.round((metrics.completed_audits / metrics.total_audits) * 100)
    : null;
  const metricCards = [
    { label: "Total clients", value: metrics?.total_clients, detail: "Active workspaces", icon: UsersRound },
    { label: "Audits run", value: metrics?.total_audits, detail: "All-time audit volume", icon: Globe2 },
    { label: "Completed", value: metrics?.completed_audits, detail: completionRate === null ? "No audits yet" : `${completionRate}% completion rate`, icon: CheckCircle2 },
    { label: "Failed", value: metrics?.failed_audits, detail: metrics?.failed_audits ? "Runs that need review" : "No failed runs", icon: Clock3 },
    { label: "Average score", value: metrics?.average_score == null ? "—" : `${metrics.average_score}/100`, detail: "Across completed audits", icon: Gauge }
  ];
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? clients[0];

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">Good work starts with clear signals</div>
          <h1 className="page-title">Operations overview</h1>
          <div className="subtle">Track client health, audit progress, and the next opportunities to improve organic search.</div>
        </div>
        <div className="shell-actions">
          <span className="refresh-label">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading dashboard"}
          </span>
          <button className="button secondary icon-button" type="button" onClick={() => void load()} disabled={refreshing} aria-label="Refresh dashboard" title="Refresh dashboard">
            <RefreshCw size={15} className={refreshing ? "spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </section>

      {error && <div className="notice" role="alert">{error}</div>}
      {message && <div className="notice success" role="status">{message}</div>}

      <section className="grid metrics" aria-label="Dashboard metrics">
        {metricCards.map(({ label, value, detail, icon: Icon }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top">
              <span className="metric-label">{label}</span>
              <span className="metric-icon"><Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span>
            </div>
            {loading ? <div className="skeleton" style={{ width: "56%", marginTop: 16 }} /> : <div className="metric-value">{value ?? "—"}</div>}
            <div className="metric-foot">{detail}</div>
          </article>
        ))}
      </section>

      <section className="grid dashboard-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Recent audits</h2>
              <p className="section-caption">Latest activity across all client websites</p>
            </div>
            <a className="button secondary small" href="/admin/audits">View history <ArrowRight size={13} aria-hidden="true" /></a>
          </div>
          {!data?.recent.length ? (
            <div className="empty-state">
              <div>
                <span className="empty-icon"><Globe2 size={19} aria-hidden="true" /></span>
                <strong>{loading ? "Loading recent audits" : "Your audit activity will show here"}</strong>
                <p>{loading ? "Fetching the latest workspace data." : "Start an audit to get an evidence-based view of a website’s SEO health."}</p>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Client / website</th><th>Status</th><th>Progress</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {data.recent.slice(0, 7).map((audit) => {
                    const progress = Math.max(0, Math.min(100, Number(audit.progress) || 0));
                    const score = audit.overall_score;
                    return (
                      <tr key={audit.id}>
                        <td>
                          <strong>{audit.client_name}</strong>
                          <div className="subtle" style={{ fontSize: 10 }}>{audit.website_url}</div>
                          <div className="subtle" style={{ fontSize: 10 }}>{formatDate(audit.created_at)}</div>
                          {audit.error_message && <div className="subtle" style={{ color: "#a84637", whiteSpace: "normal" }}>{audit.error_message}</div>}
                        </td>
                        <td><span className={`badge ${statusClass(audit.status)}`}>{audit.status}</span></td>
                        <td>
                          <div className="progress-line">
                            <div className="progress" style={{ width: 76 }}><span style={{ width: `${progress}%` }} /></div>
                            <small>{progress}%</small>
                          </div>
                        </td>
                        <td>{score == null ? <span className="subtle">—</span> : <span className="score-pill">{score}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="card">
          <div className="section-heading">
            <div>
              <h2 className="section-title">Start an audit</h2>
              <p className="section-caption">Queue an SEO review for a client website</p>
            </div>
            <span className="metric-icon"><Plus size={16} aria-hidden="true" /></span>
          </div>
          {!clients.length && !loading ? (
            <div className="empty-state">
              <div>
                <span className="empty-icon"><UsersRound size={19} aria-hidden="true" /></span>
                <strong>Add a client to get started</strong>
                <p>Each audit is linked to a client workspace and its website.</p>
                <a className="button small" href="/admin/clients" style={{ marginTop: 13 }}>Manage clients <ArrowRight size={13} aria-hidden="true" /></a>
              </div>
            </div>
          ) : (
            <form className="audit-form" onSubmit={startAudit}>
              <div className="field">
                <label htmlFor="client_id">Client workspace</label>
                <select
                  className="select"
                  id="client_id"
                  name="client_id"
                  required
                  value={selectedClient?.id ?? ""}
                  disabled={!clients.length || loading}
                  onChange={(event) => {
                    const client = clients.find((item) => item.id === event.target.value);
                    setSelectedClientId(event.target.value);
                    if (client) setWebsiteUrl(client.website_url);
                  }}
                >
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="website_url">Website URL</label>
                <input
                  id="website_url"
                  name="website_url"
                  className="input"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  required
                  disabled={!clients.length || loading}
                />
                <p className="field-hint">We’ll crawl public pages and collect SEO signals for an asynchronous report.</p>
              </div>
              <button className="button" type="submit" disabled={busy || loading || !clients.length}>
                <Plus size={15} aria-hidden="true" />
                {busy ? "Queueing audit..." : "Queue SEO audit"}
              </button>
              <p className="refresh-label" style={{ margin: 0 }}>Progress refreshes automatically every 30 seconds.</p>
            </form>
          )}
        </article>
      </section>
    </>
  );
}
