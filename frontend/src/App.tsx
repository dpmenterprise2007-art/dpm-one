import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Bell, BriefcaseBusiness, Building2, CalendarClock, CheckCircle2, ChevronRight, FileText, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck, Users, Wallet, X } from "lucide-react";
import Login from "./Login";

const API = import.meta.env.VITE_API_URL || "";
type Module = "overview" | "leads" | "employees" | "customers" | "contacts" | "follow-ups" | "site-visits" | "quotations";
type Row = Record<string, unknown> & { id?: number };
type Field = { name: string; label: string; type?: string; required?: boolean; options?: string[]; placeholder?: string };

const modules: { id: Module; label: string; icon: typeof LayoutDashboard; endpoint?: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "leads", label: "Leads & Pipeline", icon: Activity, endpoint: "/api/v1/leads?limit=200" },
  { id: "employees", label: "Employees", icon: BriefcaseBusiness, endpoint: "/api/v1/employees?limit=200" },
  { id: "customers", label: "Customers", icon: Building2, endpoint: "/api/v1/customers?limit=200" },
  { id: "contacts", label: "Contacts", icon: Users, endpoint: "/api/v1/contacts?limit=200" },
  { id: "follow-ups", label: "Follow-ups", icon: CalendarClock, endpoint: "/api/v1/follow-ups" },
  { id: "site-visits", label: "Site Visits", icon: ShieldCheck, endpoint: "/api/v1/site-visits" },
  { id: "quotations", label: "Quotations & BOQ", icon: FileText, endpoint: "/api/v1/quotations" },
];

const forms: Partial<Record<Module, Field[]>> = {
  leads: [
    {name:"company_name",label:"Company / Client name",required:true},{name:"contact_name",label:"Contact person",required:true},
    {name:"phone",label:"Phone number",required:true},{name:"email",label:"Email",type:"email"},
    {name:"project_type",label:"Project type",type:"select",options:["Corporate Interior","Commercial Interior","Residential Interior","Furniture Manufacturing","Government / GeM","Other"]},
    {name:"estimated_value",label:"Estimated project value (₹)",type:"number"},{name:"notes",label:"Notes",type:"textarea"}
  ],
  employees: [
    {name:"full_name",label:"Employee full name",required:true},{name:"email",label:"Work email",type:"email",required:true},
    {name:"temporary_password",label:"Temporary password (minimum 14 characters)",type:"password",required:true},
    {name:"role",label:"Role",type:"select",options:["manager","sales","accounts","operations","staff"]}
  ],
  customers: [
    {name:"legal_name",label:"Legal name",required:true},{name:"customer_type",label:"Customer type",type:"select",options:["company","individual","government","partnership"]},
    {name:"gstin",label:"GSTIN"},{name:"pan",label:"PAN"},{name:"email",label:"Email",type:"email"},
    {name:"phone",label:"Phone"},{name:"state_code",label:"GST state code"},{name:"billing_address",label:"Billing address",type:"textarea"},
    {name:"shipping_address",label:"Shipping address",type:"textarea"}
  ],
  contacts: [
    {name:"customer_id",label:"Customer ID (optional)",type:"number"},{name:"full_name",label:"Contact full name",required:true},
    {name:"designation",label:"Designation"},{name:"email",label:"Email",type:"email"},{name:"phone",label:"Phone",required:true}
  ],
  "follow-ups": [
    {name:"lead_id",label:"Lead ID",type:"number",required:true},{name:"assigned_to",label:"Assigned employee ID",type:"number"},
    {name:"due_at",label:"Due date & time",type:"datetime-local",required:true},
    {name:"channel",label:"Channel",type:"select",options:["call","email","whatsapp","meeting","other"]},{name:"notes",label:"Notes",type:"textarea"}
  ],
  "site-visits": [
    {name:"lead_id",label:"Lead ID",type:"number",required:true},{name:"scheduled_at",label:"Requested date & time",type:"datetime-local",required:true},
    {name:"site_address",label:"Site address",type:"textarea",required:true},{name:"contact_person",label:"Site contact person",required:true},
    {name:"contact_phone",label:"Site contact phone",required:true},{name:"scope_notes",label:"Scope / access notes",type:"textarea"}
  ],
  quotations: [
    {name:"customer_id",label:"Customer ID",type:"number",required:true},{name:"lead_id",label:"Lead ID (optional)",type:"number"},
    {name:"title",label:"Quotation title",required:true},{name:"description",label:"BOQ item description",required:true},
    {name:"hsn_sac",label:"HSN / SAC"},{name:"quantity",label:"Quantity",type:"number",required:true},
    {name:"unit",label:"Unit",type:"select",options:["Nos","Sqft","Rft","Set","Lot","Job","Kg"]},
    {name:"rate_inr",label:"Rate (₹)",type:"number",required:true},{name:"gst_rate",label:"GST rate (%)",type:"select",options:["0","5","12","18","28"]}
  ]
};

const titles: Record<Module,string> = {
  overview:"Business command centre",leads:"Leads & sales pipeline",employees:"Employee management",customers:"Customer register",
  contacts:"Contact directory","follow-ups":"Follow-up planner","site-visits":"Site visit booking",quotations:"Quotations & BOQ"
};
const money = (value: unknown) => typeof value === "number" ? new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value) : "—";
const dateText = (value: unknown) => typeof value === "string" && value ? new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}) : "—";

export default function App() {
  const [token,setToken] = useState(() => sessionStorage.getItem("dpm_one_token") || "");
  const [active,setActive] = useState<Module>("overview");
  const [records,setRecords] = useState<Row[]>([]);
  const [counts,setCounts] = useState<Record<string,number>>({});
  const [profile,setProfile] = useState<Row | null>(null);
  const [apiState,setApiState] = useState<"checking"|"online"|"offline">("checking");
  const [query,setQuery] = useState("");
  const [showForm,setShowForm] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [form,setForm] = useState<Record<string,string>>({});
  const [mobileNav,setMobileNav] = useState(false);
  const [notice,setNotice] = useState("");

  async function request(path:string, options:RequestInit={}) {
    const response = await fetch(API + path,{...options,headers:{...(options.headers || {}),Authorization:`Bearer ${token}`,...(options.body ? {"Content-Type":"application/json"} : {})}});
    if (response.status === 401) { logout(); throw new Error("Session expired. Please sign in again."); }
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try { const body=await response.json(); message=body.detail || message; } catch {}
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
    if (response.status === 204) return null;
    return response.json();
  }
  function logout(){sessionStorage.removeItem("dpm_one_token");setToken("");setProfile(null);setRecords([]);}
  async function loadModule(id:Module) {
    if (id === "overview") { setRecords([]); return; }
    const item=modules.find(m=>m.id===id);
    if (!item?.endpoint) return;
    try { const data=await request(item.endpoint); setRecords(Array.isArray(data)?data:[]); setApiState("online"); }
    catch(e){setError(e instanceof Error?e.message:"Could not load records");setApiState("offline");}
  }
  async function loadCounts() {
    const result:Record<string,number>={};
    for (const item of modules.filter(m=>m.endpoint)) {
      try { const data=await request(item.endpoint!); result[item.id]=Array.isArray(data)?data.length:0; }
      catch { result[item.id]=0; }
    }
    setCounts(result);
  }
  useEffect(()=>{if(!token)return; (async()=>{try{const me=await request("/api/v1/auth/me");setProfile(me);setApiState("online");await loadCounts();await loadModule(active);}catch{setApiState("offline");}})();},[token]);
  useEffect(()=>{if(token)void loadModule(active);},[active,token]);

  const filtered=useMemo(()=>records.filter(row=>JSON.stringify(row).toLowerCase().includes(query.toLowerCase())),[records,query]);
  const totalPipeline=records.filter(r=>active==="leads").reduce((s,r)=>s+Number(r.estimated_value||0),0);
  function startCreate(){setError("");setNotice("");setForm({gst_rate:"18",quantity:"1",unit:"Sqft",channel:"call",role:"sales",customer_type:"company",project_type:"Corporate Interior"});setShowForm(true);}
  async function createRecord(event:FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const payload:Record<string,unknown>={...form};
      for(const key of ["estimated_value","customer_id","lead_id","assigned_to","quantity","rate_inr"]) if(payload[key]==="")delete payload[key]; else if(payload[key]!==undefined)payload[key]=Number(payload[key]);
      if(payload.gst_rate!==undefined)payload.gst_rate=Number(payload.gst_rate);
      if(payload.gstin)payload.gstin=String(payload.gstin).toUpperCase();
      if(payload.pan)payload.pan=String(payload.pan).toUpperCase();
      for(const key of ["email","gstin","pan","billing_address","shipping_address","state_code","notes","scope_notes","hsn_sac","designation"])if(payload[key]==="")payload[key]=null;
      if(payload.due_at)payload.due_at=new Date(String(payload.due_at)).toISOString();
      if(payload.scheduled_at)payload.scheduled_at=new Date(String(payload.scheduled_at)).toISOString();
      let endpoint=modules.find(m=>m.id===active)?.endpoint?.split("?")[0] || "";
      if(active==="quotations"){
        const {description,hsn_sac,quantity,unit,rate_inr,gst_rate,...header}=payload;
        header.lines=[{description,hsn_sac,quantity,unit,rate_inr,gst_rate}];
        await request(endpoint,{method:"POST",body:JSON.stringify(header)});
      } else {
        if(active==="employees"){payload.temporary_password=String(form.temporary_password);}
        await request(endpoint,{method:"POST",body:JSON.stringify(payload)});
      }
      setShowForm(false);setNotice("Record saved successfully.");await loadModule(active);await loadCounts();
    } catch(e){setError(e instanceof Error?e.message:"Unable to save record");}
    finally{setBusy(false);}
  }
  async function completeFollowUp(id:number) {
    try{await request(`/api/v1/follow-ups/${id}/complete`,{method:"PATCH"});await loadModule(active);}
    catch(e){setError(e instanceof Error?e.message:"Unable to complete follow-up");}
  }
  async function changeLeadStage(id:number,stage:string) {
    try{await request(`/api/v1/leads/${id}`,{method:"PATCH",body:JSON.stringify({stage})});await loadModule(active);}
    catch(e){setError(e instanceof Error?e.message:"Unable to update lead stage");}
  }
  if(!token)return <Login onLogin={value=>{sessionStorage.setItem("dpm_one_token",value);setToken(value);}}/>;

  const current=modules.find(m=>m.id===active)!;
  const fields=forms[active]||[];
  const cols:Record<Module,string[]>={overview:[],leads:["company_name","contact_name","phone","project_type","estimated_value","stage"],employees:["full_name","email","role","is_active"],customers:["legal_name","gstin","pan","phone","email","status"],contacts:["full_name","designation","phone","email","customer_id"],"follow-ups":["lead_id","due_at","channel","assigned_to","status","notes"],"site-visits":["lead_id","scheduled_at","site_address","contact_person","fee_total","payment_status","visit_status"],quotations:["quotation_number","title","customer_id","status","total_paise","valid_until"]};
  const labels:Record<string,string>={company_name:"Company",contact_name:"Contact",phone:"Phone",project_type:"Project",estimated_value:"Estimated value",stage:"Stage",full_name:"Name",email:"Email",role:"Role",is_active:"Active",legal_name:"Legal name",gstin:"GSTIN",pan:"PAN",status:"Status",designation:"Designation",customer_id:"Customer ID",lead_id:"Lead ID",due_at:"Due date",channel:"Channel",assigned_to:"Assigned to",notes:"Notes",scheduled_at:"Visit date",site_address:"Site address",contact_person:"Site contact",fee_total:"Fee incl. GST",payment_status:"Payment",visit_status:"Visit status",quotation_number:"Quotation no.",title:"Title",total_paise:"Total (₹ paise)",valid_until:"Valid until"};
  const display=(key:string,value:unknown)=>key==="estimated_value"?money(value):key==="fee_total"?money(Number(value)):key==="total_paise"?money(Number(value)/100):key==="due_at"||key==="scheduled_at"||key==="valid_until"?dateText(value):typeof value==="boolean"?(value?"Yes":"No"):String(value??"—");
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"sidebar-open":""}`}>
      <div className="brand"><div className="brand-mark">D</div><div><strong>DPM ONE</strong><span>ENTERPRISE OS</span></div><button className="mobile-close" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace"><div className="workspace-icon">DP</div><div><b>DPM ENTERPRISE</b><small>Private workspace</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{modules.map(item=><button key={item.id} onClick={()=>{setActive(item.id);setQuery("");setError("");setNotice("");setMobileNav(false);}} className={active===item.id?"nav-item active":"nav-item"}><item.icon size={17}/><span>{item.label}</span>{item.id!=="overview"&&<em>{counts[item.id]??0}</em>}</button>)}</nav>
      <div className="nav-label tools-label">COMING NEXT</div><div className="coming-list"><span>Projects & execution</span><span>Procurement & inventory</span><span>Finance & statutory billing</span><span>Office ↔ Cloud sync</span></div>
      <div className="sidebar-bottom"><div className="user-row"><div className="avatar">DP</div><div><b>{String(profile?.full_name||"DPM User")}</b><small>{String(profile?.role||"workspace")}</small></div><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={16}/></button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="menu-button" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="crumb">Workspace <span>/</span> <b>{current.label}</b></div><div className="top-actions"><div className={`api-pill ${apiState}`}><i/>{apiState==="online"?"API connected":apiState==="offline"?"API offline":"Connecting…"}</div><div className="top-avatar">DP</div></div></header>
      <section className="content">
        <div className="page-heading"><div><div className="eyebrow"><ShieldCheck size={13}/> DPM ENTERPRISE · PRIVATE WORKSPACE</div><h1>{active==="overview"?"Good morning, DPM.":titles[active]}</h1><p>{active==="overview"?"Your business operations at a glance.":"Manage records and business workflows from one place."}</p></div>{active!=="overview"&&<button className="primary-button" onClick={startCreate}><Plus size={17}/> Add {active==="leads"?"lead":active==="employees"?"employee":active==="customers"?"customer":active==="contacts"?"contact":active==="follow-ups"?"follow-up":active==="site-visits"?"site visit":"quotation"}</button>}</div>
        {notice&&<div className="notice success-notice"><CheckCircle2 size={18}/><span>{notice}</span></div>}
        {error&&<div className="notice error-notice"><X size={18}/><span>{error}</span><button onClick={()=>setError("")}>Dismiss</button></div>}
        {active==="overview"?<><div className="notice"><div className="notice-icon"><ShieldCheck size={18}/></div><div><b>CRM & operations foundation</b><span>Use the navigation to manage employees, leads, customers, follow-ups, site visits and quotations.</span></div><span className="notice-tag">PRIVATE</span></div>
          <div className="section-head"><div><h2>Business snapshot</h2><p>Current records from the connected API</p></div><button className="period-button" onClick={()=>void loadCounts()}>Refresh <ArrowRight size={14}/></button></div>
          <div className="metrics">{modules.filter(m=>m.id!=="overview").slice(0,4).map(m=><article className="metric-card" key={m.id}><div className="metric-top"><span>{m.label}</span><div className="metric-icon blue"><m.icon size={18}/></div></div><strong>{counts[m.id]??0}</strong><div className="metric-note">Records available</div></article>)}</div>
          <div className="section-head"><div><h2>Operations modules</h2><p>Open a module to create and manage records</p></div></div><div className="module-grid">{modules.filter(m=>m.id!=="overview").map(m=><button className="module-card" key={m.id} onClick={()=>setActive(m.id)}><m.icon size={20}/><b>{m.label}</b><span>{counts[m.id]??0} records</span><ChevronRight size={16}/></button>)}</div>
        </>:<><div className="section-head"><div><h2>{titles[active]}</h2><p>{filtered.length} records loaded</p></div><div className="search-box"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records"/></div></div>
          {active==="site-visits"&&<div className="notice fee-notice"><ShieldCheck size={18}/><div><b>Mandatory site visit fee: ₹5,000 + 18% GST = ₹5,900</b><span>Fee is fixed by DPM policy and cannot be waived through this form. Visit confirmation is subject to Accounts payment verification.</span></div></div>}
          <div className="table-card"><div className="table-toolbar"><div className="table-title"><b>{titles[active]}</b><span>{filtered.length} records</span></div></div><div className="table-scroll"><table><thead><tr>{(cols[active]||[]).map(key=><th key={key}>{labels[key]||key}</th>)}{(active==="follow-ups"||active==="leads")&&<th>ACTION</th>}</tr></thead><tbody>
            {filtered.length?filtered.map((row,i)=><tr key={String(row.id??i)}>{(cols[active]||[]).map(key=><td key={key}>{active==="leads"&&key==="stage"?<select className="inline-select" value={String(row.stage||"new")} onChange={e=>void changeLeadStage(Number(row.id),e.target.value)}>{["new","contacted","qualified","proposal","negotiation","won","lost"].map(s=><option key={s}>{s}</option>)}</select>:display(key,row[key])}</td>)}{active==="follow-ups"&&<td>{row.status==="completed"?"Done":<button className="small-action" onClick={()=>void completeFollowUp(Number(row.id))}>Complete</button>}</td>}{active==="leads"&&<td><button className="small-action" onClick={()=>{setActive("follow-ups");setForm({lead_id:String(row.id),channel:"call"});setShowForm(true);}}>Schedule follow-up</button></td>}</tr>):<tr><td colSpan={(cols[active]||[]).length+1}><div className="empty-state"><div className="empty-icon"><current.icon size={22}/></div><b>No records found</b><span>Create your first record to begin.</span></div></td></tr>}
          </tbody></table></div></div></>}
        <footer><span>© 2026 DPM ONE · DPM ENTERPRISE PRIVATE LIMITED</span><span><i className={apiState==="online"?"live-dot":"idle-dot"}/> {apiState==="online"?"Systems connected":"Connection needs attention"}</span></footer>
      </section>
    </main>
    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="lead-modal" onSubmit={createRecord} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">DPM ONE · NEW RECORD</span><h2>Add {titles[active].toLowerCase()}</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}><X size={18}/></button></div>
      <div className="form-grid">{fields.map(field=><label key={field.name} className={field.type==="textarea"?"wide-field":""}>{field.label}{field.type==="select"?<select required={field.required} value={form[field.name]||""} onChange={e=>setForm({...form,[field.name]:e.target.value})}>{(field.options||[]).map(v=><option key={v} value={v}>{v}</option>)}</select>:field.type==="textarea"?<textarea required={field.required} value={form[field.name]||""} onChange={e=>setForm({...form,[field.name]:e.target.value})}/>:<input required={field.required} type={field.type||"text"} min={field.type==="number"?"0":undefined} value={form[field.name]||""} placeholder={field.placeholder||""} onChange={e=>setForm({...form,[field.name]:e.target.value})}/>}</label>)}</div>
      {active==="site-visits"&&<div className="fee-summary"><b>₹5,000</b> base fee + <b>₹900</b> GST (18%) = <strong>₹5,900 payable</strong></div>}
      {error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary-button" disabled={busy}>{busy?"Saving…":"Save record"}</button></div>
    </form></div>}
  </div>;
}
