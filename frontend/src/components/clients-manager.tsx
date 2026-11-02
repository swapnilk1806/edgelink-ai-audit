"use client";

import { FormEvent, useEffect, useState } from "react";
import { readApiResponse } from "@/lib/api-response";

type Client = { id: string; name: string; website_url: string; business_type: string; business_location: string; contact_name: string; contact_email: string; contact_phone: string | null; login_email: string | null };
const initial = { name:"", website_url:"https://", business_type:"", business_location:"", contact_name:"", contact_email:"", contact_phone:"", login_password:"" };

export default function ClientsManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/clients");
    setClients(await readApiResponse<Client[]>(response));
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  function startEdit(client: Client) {
    setEditing(client.id);
    setForm({ name:client.name, website_url:client.website_url, business_type:client.business_type, business_location:client.business_location, contact_name:client.contact_name, contact_email:client.contact_email, contact_phone:client.contact_phone || "", login_password:"" });
    setMessage("");
  }
  function reset() { setForm(initial); setEditing(null); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);setError("");setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/clients/${editing}` : "/api/admin/clients", {
        method: editing ? "PUT" : "POST", headers:{"content-type":"application/json"},
        body:JSON.stringify({...form, contact_phone:form.contact_phone || null, login_password:form.login_password || undefined})
      });
      await readApiResponse<Client>(response);
      setMessage(editing ? "Client details updated." : "Client created successfully.");
      reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save client"); }
    finally { setBusy(false); }
  }
  async function remove(client: Client) {
    if (!window.confirm(`Delete ${client.name} and its audit history?`)) return;
    setError("");setMessage("");
    try {
      const response = await fetch(`/api/admin/clients/${client.id}`, {method:"DELETE"});
      await readApiResponse<{ ok: boolean }>(response);
      setMessage(`${client.name} was deleted.`); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to delete client"); }
  }
  const fields: Array<[keyof typeof initial,string,string]> = [
    ["name","Business name","text"],["website_url","Website URL","url"],["business_type","Business type","text"],["business_location","Business location","text"],["contact_name","Contact name","text"],["contact_email","Contact email / login","email"],["contact_phone","Contact phone","tel"],["login_password","Client login password (new clients)","password"]
  ];
  return <>
    <div className="topline"><div><h1 className="page-title">Clients</h1><div className="subtle">Create and manage client workspaces.</div></div></div>
    {error && <div className="notice">{error}</div>}{message && <div className="notice success">{message}</div>}
    <section className="grid two-col" style={{alignItems:"start"}}>
      <article className="card"><h2 className="section-title">{editing ? "Edit client" : "Add a client"}</h2>
        <form onSubmit={submit}><div className="form-grid">
          {fields.map(([name,label,type]) => <div className="field" key={name}><label htmlFor={name}>{label}{name==="login_password" && !editing ? " *" : ""}</label><input className="input" id={name} type={type} required={name!=="contact_phone" && (name!=="login_password" || !editing)} minLength={name==="login_password"?10:undefined} value={form[name]} onChange={(e)=>setForm({...form,[name]:e.target.value})} disabled={editing!==null && name==="login_password"} /></div>)}
        </div><div style={{display:"flex",gap:9,marginTop:18}}><button className="button" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Create client"}</button>{editing && <button className="button secondary" type="button" onClick={reset}>Cancel</button>}</div></form>
        <p className="subtle" style={{marginTop:14}}>A password creates a secure client login. Set at creation; the client should change it through your account provisioning process.</p>
      </article>
      <article className="card"><h2 className="section-title">Client directory <span className="subtle">({clients.length})</span></h2>
        {!clients.length ? <p className="subtle">No clients have been added.</p> : clients.map((client)=><div key={client.id} style={{borderBottom:"1px solid #edf0f1",padding:"13px 0",display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
          <div><strong>{client.name}</strong><div className="subtle">{client.website_url}</div><div className="subtle">{client.contact_email}</div></div>
          <div style={{display:"flex",gap:7}}><button className="button secondary" onClick={()=>startEdit(client)}>Edit</button><button className="button danger" onClick={()=>void remove(client)}>Delete</button></div>
        </div>)}
      </article>
    </section>
  </>;
}
