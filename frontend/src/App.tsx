import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BriefcaseBusiness, Building2,
  CalendarDays, ChevronDown, CircleHelp, ClipboardList, FileText, FolderKanban,
  LayoutDashboard, Menu, Plus, Search, Settings, ShieldCheck, Users, Wallet,
  X, Zap
} from "lucide-react";

type Lead = {
  id: number; company_name: string; contact_name: string; phone: string;
  email?: string | null; project_type: string; estimated_value?: number | null;
  stage: string; notes?: string | null;
};

const API = import.meta.env.VITE_API_URL || "";

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Leads & CRM", icon: Users },
  { label: "Sales pipeline", icon: Activity },
  { label: "Projects", icon: FolderKanban },
  { label: "Quotations & BOQ", icon: FileText },
  { label: "Procurement", icon: ClipboardList },
  { label: "Inventory", icon: Building2 },
  { label: "Finance", icon: Wallet },
  { label: "Team & HR", icon: BriefcaseBusiness },
];

const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(value);

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [token, setToken] = useState<string>(() => sessionStorage.getItem("dpm_one_token") || "");
  const [apiState, setApiState] = useState<"checking" | "online" | "offline">("checking");
  const [query, setQuery] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [form, setForm] = useState({ company_name: "", contact_name: "", phone: "", project_type: "Corporate Interior", estimated_value: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [health, response] = await Promise.all([
        fetch(`${API}/health`),
        fetch(`${API}/api/v1/leads?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (!health.ok || !response.ok) throw new Error("API unavailable");
      setLeads(await response.json());
      setApiState("online");
    } catch {
      setApiState("offline");
    }
  }

  useEffect(() => { if (token) void load(); }, [token]);

  async function createLead(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch(`${API}/api/v1/leads`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, estimated_value: form.estimated_value ? Number(form.estimated_value) : null })
      });
      if (!response.ok) throw new Error("Lead could not be saved. Check required fields and API.");
      setForm({ company_name: "", contact_name: "", phone: "", project_type: "Corporate Interior", estimated_value: "" });
      setShowLeadForm(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setSaving(false); }
  }

  const filtered = useMemo(() => leads.filter((lead) =>
    [lead.company_name, lead.contact_name, lead.phone].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [leads, query]);
  const pipelineValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
  const activeLeads = leads.filter((lead) => !["won", "lost"].includes(lead.stage.toLowerCase())).length;

  if (!token) return <Login onLogin={(value) => { sessionStorage.setItem("dpm_one_token", value); setToken(value); }} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark">D</div><div><strong>DPM ONE</strong><span>ENTERPRISE OS</span></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace"><div className="workspace-icon">DP</div><div><b>DPM ENTERPRISE</b><small>Private workspace</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(({label, icon: Icon, active}) => <button key={label} className={active ? "nav-item active" : "nav-item"}><Icon size={17}/><span>{label}</span>{label === "Leads & CRM" && <em>{leads.length}</em>}</button>)}</nav>
      <div className="nav-label tools-label">MANAGE</div>
      <nav>
        <button className="nav-item"><CalendarDays size={17}/><span>Calendar & Tasks</span></button>
        <button className="nav-item"><ShieldCheck size={17}/><span>Access & Audit</span></button>
        <button className="nav-item"><Settings size={17}/><span>Settings</span></button>
      </nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Need a hand?</b><p>Get help with your workspace and workflows.</p><button>Open help centre <ArrowUpRight size={13}/></button></div><div className="user-row"><div className="avatar">DP</div><div><b>DPM Admin</b><small>Workspace owner</small></div><Settings size={16}/></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="crumb">Workspace <span>/</span> <b>Overview</b></div><div className="top-actions"><div className={`api-pill ${apiState}`}><i/>{apiState === "online" ? "API connected" : apiState === "offline" ? "API offline" : "Connecting…"}</div><button className="icon-button"><Search size={18}/></button><button className="icon-button notification"><Bell size={18}/><i/></button><div className="top-avatar">DP</div></div></header>

      <section className="content">
        <div className="page-heading"><div><div className="eyebrow"><Zap size={13}/> BUSINESS COMMAND CENTRE</div><h1>Good morning, DPM.</h1><p>Here’s what’s happening across your business today.</p></div><button className="primary-button" onClick={() => setShowLeadForm(true)}><Plus size={17}/> Create lead</button></div>
        <div className="notice"><div className="notice-icon"><ShieldCheck size={18}/></div><div><b>Your workspace is being prepared</b><span>CRM foundation is connected. Additional modules will appear as they are implemented and verified.</span></div><span className="notice-tag">FOUNDATION</span></div>

        <div className="section-head"><div><h2>Business snapshot</h2><p>Live figures from your CRM records</p></div><button className="period-button">All time <ChevronDown size={14}/></button></div>
        <div className="metrics">
          <Metric title="Total leads" value={String(leads.length)} note="Recorded in CRM" icon={<Users size={18}/>} tone="blue" />
          <Metric title="Active opportunities" value={String(activeLeads)} note="Excludes won & lost" icon={<Zap size={18}/>} tone="violet" />
          <Metric title="Pipeline value" value={money(pipelineValue)} note="Based on estimated values" icon={<Wallet size={18}/>} tone="green" />
          <Metric title="Projects in progress" value="—" note="Projects module upcoming" icon={<FolderKanban size={18}/>} tone="amber" />
        </div>

        <div className="section-head leads-head"><div><h2>Recent leads</h2><p>Keep track of incoming business opportunities</p></div><button className="text-button" onClick={() => setShowLeadForm(true)}>View / add leads <ArrowUpRight size={14}/></button></div>
        <div className="table-card"><div className="table-toolbar"><div className="table-title"><b>Lead register</b><span>{filtered.length} records</span></div><div className="search-box"><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company, contact or phone"/></div></div>
          <div className="table-scroll"><table><thead><tr><th>COMPANY / CONTACT</th><th>PROJECT TYPE</th><th>EST. VALUE</th><th>STAGE</th></tr></thead><tbody>
            {filtered.length ? filtered.slice(0, 8).map((lead) => <tr key={lead.id}><td><div className="company-cell"><div className="company-avatar">{lead.company_name.slice(0,1).toUpperCase()}</div><div><b>{lead.company_name}</b><small>{lead.contact_name} · {lead.phone}</small></div></div></td><td>{lead.project_type}</td><td className="value-cell">{lead.estimated_value ? money(lead.estimated_value) : "—"}</td><td><span className={`stage stage-${lead.stage.toLowerCase()}`}>{lead.stage.replaceAll("_", " ")}</span></td></tr>) : <tr><td colSpan={4}><div className="empty-state"><div className="empty-icon"><Users size={22}/></div><b>No leads yet</b><span>Create your first lead to start building the pipeline.</span><button onClick={() => setShowLeadForm(true)}><Plus size={15}/> Add first lead</button></div></td></tr>}
          </tbody></table></div></div>
        <footer><span>© 2026 DPM ONE · DPM ENTERPRISE PRIVATE LIMITED</span><span><i className={apiState === "online" ? "live-dot" : "idle-dot"}/> {apiState === "online" ? "Systems operational" : "Waiting for API connection"}</span></footer>
      </section>
    </main>

    {showLeadForm && <div className="modal-backdrop" onClick={() => setShowLeadForm(false)}><form className="lead-modal" onSubmit={createLead} onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">CRM · NEW RECORD</span><h2>Create a lead</h2></div><button type="button" className="icon-button" onClick={() => setShowLeadForm(false)}><X size={18}/></button></div><label>Company name<input required minLength={2} value={form.company_name} onChange={(e) => setForm({...form, company_name:e.target.value})} placeholder="e.g. ABC Corporate Pvt Ltd"/></label><label>Contact person<input required minLength={2} value={form.contact_name} onChange={(e) => setForm({...form, contact_name:e.target.value})} placeholder="Full name"/></label><label>Phone number<input required minLength={7} value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} placeholder="+91"/></label><label>Project type<select value={form.project_type} onChange={(e) => setForm({...form, project_type:e.target.value})}><option>Corporate Interior</option><option>Commercial Interior</option><option>Residential Interior</option><option>Furniture Manufacturing</option><option>Government / GeM</option><option>Other</option></select></label><label>Estimated project value (₹)<input type="number" min="0" value={form.estimated_value} onChange={(e) => setForm({...form, estimated_value:e.target.value})} placeholder="e.g. 1500000"/></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowLeadForm(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save lead"}</button></div></form></div>}
  </div>;
}

function Metric({title, value, note, icon, tone}: {title:string;value:string;note:string;icon:React.ReactNode;tone:string}) {
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><div className={`metric-icon ${tone}`}>{icon}</div></div><strong>{value}</strong><div className="metric-note"><span className="neutral-trend"><ArrowDownRight size={13}/></span>{note}</div></article>;
}
