import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer
} from "recharts";

const API = "/api";

const scoreColor = (s) => s >= 75 ? "#16a34a" : s >= 50 ? "#f59e0b" : "#dc2626";
const scoreBg    = (s) => s >= 75 ? "#f0fdf4" : s >= 50 ? "#fffbeb" : "#fef2f2";
const ratingMeta = {
  A:{ bg:"#14532d",text:"#ffffff",label:"Excellent",icon:"🟢" },
  B:{ bg:"#dcfce7",text:"#15803d",label:"Good",     icon:"🟢" },
  C:{ bg:"#dbeafe",text:"#1d4ed8",label:"Fair",     icon:"🔵" },
  D:{ bg:"#fee2e2",text:"#b91c1c",label:"Poor",     icon:"🔴" },
  F:{ bg:"#1a1a1a",text:"#ffffff",label:"Critical", icon:"🔴" },
};

function fmtMins(min){
  if(!min&&min!==0)return"—";
  const h=Math.floor(min/60),m=Math.round(min%60);
  if(h===0)return`${m} min`;if(m===0)return`${h} hr`;return`${h} hr ${m} min`;
}
function fmtInt(n){
  if(n===null||n===undefined||n==="")return"—";
  return Math.round(Number(n)).toLocaleString("en-IN");
}
function fmtKw(n){
  if(n===null||n===undefined)return"—";
  return Number(n).toLocaleString("en-IN",{maximumFractionDigits:1});
}
function fmtKl(litres){
  if(!litres&&litres!==0)return"—";
  const kl=litres/1000;
  return kl>=10?Math.round(kl).toLocaleString("en-IN"):kl.toFixed(1);
}
function fmtDec(n,d=1){
  if(n===null||n===undefined)return"—";
  return Number(n).toFixed(d);
}

const PRINT_STYLE = `
@media print {
  .no-print{display:none!important}
  .print-section{display:block!important}
  body{font-size:11px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:15mm;size:A4}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
@media screen{.print-section{display:block}}
`;

// ── Searchable dropdown ───────────────────────────────────────────────────
function SearchSelect({label,value,onChange,options,placeholder,disabled,hint}){
  const[open,setOpen]=useState(false);
  const[q,setQ]=useState("");
  const ref=useRef(null);
  useEffect(()=>{
    const h=(e)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);
  const filtered=options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase()));
  const selected=options.find(o=>String(o.value)===String(value));
  return(
    <div className="flex flex-col gap-1 min-w-[240px] relative" ref={ref}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <button type="button" disabled={disabled}
        onClick={()=>{if(!disabled){setOpen(p=>!p);setQ("")}}}
        className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm rounded-xl border shadow-sm transition-all focus:outline-none
          ${disabled?"bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed":"bg-white border-gray-200 hover:border-[#106f30] cursor-pointer focus:ring-2 focus:ring-[#106f30]/20"}`}>
        <span className={selected?"text-gray-800 font-medium":"text-gray-400"}>{selected?selected.label:placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open?"rotate-180":""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open&&(
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={hint||"Search..."}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#106f30]/30"/>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length===0?<p className="px-3 py-3 text-xs text-gray-400 text-center">No results</p>
              :filtered.map(o=>(
                <button key={o.value} type="button"
                  onClick={()=>{onChange(String(o.value));setOpen(false);setQ("")}}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                    ${String(o.value)===String(value)?"bg-[#106f30]/10 text-[#106f30] font-semibold":"text-gray-700 hover:bg-gray-50"}`}>
                  {o.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Borewell diagram ──────────────────────────────────────────────────────
function BorewellDiagram({depth_ft,motor_depth_ft,swl_ref_ft,safe_draw_m}){
  const H=260,W=130;
  const toY=(ft)=>(ft/depth_ft)*(H-24)+12;
  const swlY=toY(swl_ref_ft),motY=toY(motor_depth_ft),safY=toY(swl_ref_ft+(safe_draw_m*3.281));
  return(
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <rect x="0" y="0" width={W} height="18" fill="#d97706" rx="2"/>
      <text x={W/2} y="13" textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">Ground Surface</text>
      <rect x="42" y="18" width="46" height={H-28} fill="#e5e7eb" rx="2"/>
      <rect x="44" y={swlY} width="42" height={motY-swlY} fill="#bfdbfe" rx="1"/>
      <rect x="44" y={swlY} width="42" height={safY-swlY} fill="#86efac" rx="1" opacity="0.75"/>
      <line x1="36" y1={swlY} x2={W-12} y2={swlY} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="34" y={swlY-2} textAnchor="end" fontSize="8" fill="#2563eb" fontWeight="bold">SWL</text>
      <text x="34" y={swlY+8} textAnchor="end" fontSize="7" fill="#2563eb">{swl_ref_ft} ft</text>
      <line x1="36" y1={safY} x2={W-12} y2={safY} stroke="#16a34a" strokeWidth="1" strokeDasharray="2,2"/>
      <text x="34" y={safY+4} textAnchor="end" fontSize="7" fill="#16a34a">Safe limit</text>
      <rect x="47" y={motY-6} width="36" height="12" fill="#374151" rx="2"/>
      <text x={W/2} y={motY+4} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">MOTOR</text>
      <text x="34" y={motY+3} textAnchor="end" fontSize="7" fill="#374151">{Math.round(motor_depth_ft)} ft</text>
      <rect x="62" y="18" width="4" height={motY-18} fill="#9ca3af"/>
      <ellipse cx={W/2} cy={H-8} rx="23" ry="5" fill="#6b7280"/>
      <text x={W/2} y={H-5} textAnchor="middle" fontSize="7" fill="white">{depth_ft} ft</text>
      <rect x="2" y={H-30} width="9" height="7" fill="#86efac"/>
      <text x="13" y={H-24} fontSize="7" fill="#374151">Safe zone</text>
      <rect x="2" y={H-21} width="9" height="7" fill="#bfdbfe"/>
      <text x="13" y={H-15} fontSize="7" fill="#374151">Water column</text>
    </svg>
  );
}

// ── Water level graph — INVERTED Y axis ───────────────────────────────────
function WaterLevelGraph({series,staticDepth,motorDepth,safeLimit}){
  if(!series||series.length===0){
    return(
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-2">Water Level Trend</h3>
        <p className="text-xs text-gray-400 text-center py-8">No water level data available.</p>
      </div>
    );
  }

  const safeDrawFt=staticDepth+(safeLimit*3.281);

  const invertedSeries=series.map(d=>({
    date:       d.date,
    avg:        -d.avg_depth_ft,
    deepest:    -d.max_depth_ft,
    static_lvl: -d.static_depth_ft,
  }));

  const negStatic   = -staticDepth;
  const negSafeDraw = -safeDrawFt;
  const negMotor    = -motorDepth;
  const yMin = Math.min(negMotor - 20, negSafeDraw - 10);
  const yMax = 0;

  const fmtDate=(d)=>{if(!d)return"";const p=d.split("-");return`${p[2]}/${p[1]}`};
  const fmtTick=(v)=>`${Math.abs(v)} ft`;
  const tickEvery=Math.ceil(invertedSeries.length/Math.min(invertedSeries.length,12));

  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload||!payload.length)return null;
    const avg=payload.find(p=>p.dataKey==="avg");
    const dep=payload.find(p=>p.dataKey==="deepest");
    const sta=payload.find(p=>p.dataKey==="static_lvl");
    return(
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
        <p className="font-bold text-gray-700 mb-2">{label}</p>
        {sta&&<p className="text-blue-600">Static level: {Math.abs(sta.value)} ft below surface</p>}
        {avg&&<p className="text-amber-600">Avg depth: {Math.abs(avg.value)} ft below surface</p>}
        {dep&&<p className="text-red-500">Deepest: {Math.abs(dep.value)} ft below surface</p>}
        <p className="text-gray-400 mt-1 border-t pt-1">Safe limit: {safeDrawFt.toFixed(0)} ft below surface</p>
      </div>
    );
  };

  return(
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-700">Water Level Trend — Last 3 Months</h3>
        <div className="flex gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block bg-blue-400"/>Static</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded inline-block bg-amber-300 opacity-70"/>Avg depth</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded inline-block bg-red-400"/>Deepest</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        📉 Graph shows water depth <strong>below ground surface</strong> — the line goes deeper (downward)
        as the aquifer depletes during pumping, and rises back up during rest.
        Safe limit at <strong>{safeDrawFt.toFixed(0)} ft</strong> below surface.
        {series.length>0&&` (${series[0].date} to ${series[series.length-1].date})`}
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={invertedSeries} margin={{top:8,right:16,left:0,bottom:4}}>
          <defs>
            <linearGradient id="depthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
          <XAxis dataKey="date" tickFormatter={fmtDate}
            tick={{fontSize:10,fill:"#9ca3af"}} tickLine={false} axisLine={false}
            interval={tickEvery-1}/>
          <YAxis domain={[yMin,yMax]} tickFormatter={fmtTick}
            tick={{fontSize:10,fill:"#9ca3af"}} tickLine={false} axisLine={false} width={60}/>
          <Tooltip content={<CustomTooltip/>}/>
          <ReferenceLine y={negSafeDraw} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1.5}
            label={{value:"Safe limit",position:"insideTopRight",fontSize:9,fill:"#dc2626",fontWeight:"600"}}/>
          <ReferenceLine y={negStatic} stroke="#2563eb" strokeDasharray="4 2" strokeWidth={1}
            label={{value:"Static (SWL)",position:"insideBottomRight",fontSize:9,fill:"#2563eb"}}/>
          <Area type="monotone" dataKey="avg" fill="url(#depthGrad)"
            stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg depth"/>
          <Line type="monotone" dataKey="deepest"
            stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2" dot={false} name="Deepest"/>
          <Line type="monotone" dataKey="static_lvl"
            stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Static"/>
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        {[
          {label:"Static (SWL)",    value:`${staticDepth} ft`,              color:"#2563eb", note:"Water level at rest"},
          {label:"Safe draw limit", value:`${safeDrawFt.toFixed(0)} ft`,    color:"#dc2626", note:"70% of usable column"},
          {label:"Borewell depth",  value:`${Math.round(motorDepth+100)} ft`,color:"#374151", note:"Total drilled depth"},
        ].map(item=>(
          <div key={item.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{color:item.color}}>{item.value}</p>
            <p className="text-xs text-gray-400">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────
function BigStat({icon,label,value,unit,sub,color,bg}){
  return(
    <div className="rounded-2xl p-4 border border-opacity-30 min-h-[120px]" style={{background:bg||"#f9fafb",borderColor:color||"#e5e7eb"}}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-bold leading-none" style={{color:color||"#111827"}}>
            {value}{unit&&<span className="text-base font-normal text-gray-400 ml-1">{unit}</span>}
          </p>
          {sub&&<p className="text-xs text-gray-500 mt-2">{sub}</p>}
        </div>
        {icon&&<span className="text-2xl flex-shrink-0">{icon}</span>}
      </div>
    </div>
  );
}
function FlowTile({label,value,unit,desc,color,icon}){
  return(
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{color}}>
        {value}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
      </p>
      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}
function MeterBar({label,value,color,note}){
  return(
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-gray-600 font-medium">{label}</span>
        <span className="text-sm font-bold" style={{color}}>{value}%</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{width:`${Math.min(100,Math.max(0,value))}%`,background:color}}/>
      </div>
      {note&&<p className="text-xs text-gray-400">{note}</p>}
    </div>
  );
}
function Badge({label,type="green"}){
  const s={
    green:"bg-green-100 text-green-800 border-green-200",
    amber:"bg-amber-100 text-amber-800 border-amber-200",
    red:  "bg-red-100 text-red-800 border-red-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return<span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${s[type]}`}>{label}</span>;
}
function Spinner(){
  return(
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 border-4 border-[#106f30] border-t-transparent rounded-full animate-spin"/>
      <p className="text-sm font-medium text-gray-500">Fetching data from legacy database…</p>
      <p className="text-xs text-gray-400">First load may take a moment</p>
    </div>
  );
}
function ExportBtn({onClick}){
  return(
    <button onClick={onClick}
      className="no-print flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600
                 bg-white border border-gray-200 rounded-xl hover:border-[#106f30] hover:text-[#106f30]
                 transition-all shadow-sm">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
      </svg>
      Export PDF
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — HEALTH CARD
// ══════════════════════════════════════════════════════════════════════════════
function HealthCard({data:d}){
  const sc=d.health_score||0;
  const rm=ratingMeta[d.health_rating]||ratingMeta["C"];
  const totalWaterKL=fmtKl(d.total_water_yield_l);

  const ratingRows=[
    {param:"Recharge ratio (Qr÷Qd)",value:fmtDec(d.ratio_qr_qd,2),benchmark:"≥ 0.70",
     ok:(d.ratio_qr_qd||0)>=0.70,note:(d.ratio_qr_qd||0)>=0.70?"Aquifer refills well":"Not recovering fast enough"},
    {param:"Motor efficiency",value:`${fmtInt(d.motor_efficiency_pct)}%`,benchmark:"≥ 60%",
     ok:(d.motor_efficiency_pct||0)>=60,note:"% of rated kW in use"},
    {param:"Discharge rate (Qd)",value:`${fmtDec(d.qd_m_hr,2)} m/hr`,benchmark:"< 15 m/hr",
     ok:(d.qd_m_hr||0)<15,note:"Water level drop rate while pumping"},
    {param:"Recharge rate (Qr)",value:`${fmtDec(d.qr_m_hr,2)} m/hr`,benchmark:"> 5 m/hr",
     ok:(d.qr_m_hr||0)>5,note:"Water level recovery rate when pump is off"},
    {param:"Dry run trips (3 mo)",value:d.dry_run_trips||0,benchmark:"< 5",
     ok:(d.dry_run_trips||0)<5,note:(d.dry_run_trips||0)<5?"Pump has not run dry frequently":"Too many dry runs — aquifer being over-extracted"},
    {param:"Daily runtime (avg)",value:`${fmtInt(d.avg_daily_runtime_min)} min`,benchmark:"< 800 min",
     ok:(d.avg_daily_runtime_min||0)<800,note:`${fmtMins(d.avg_daily_runtime_min)} per day`},
    {param:"Flow rate (rated)",value:`${fmtInt(d.rated_lpm)} L/min`,benchmark:"> 80 L/min",
     ok:(d.rated_lpm||0)>=80,note:"Rated pump flow from HP + depth formula"},
    ...(d.tts_reference?[{
      param:"Time to surface",value:`${fmtDec(d.tts_reference,1)} sec`,benchmark:"> 10 sec",
      ok:true,note:`Static depth: ${fmtInt(d.static_depth_ft)} ft below ground`
    }]:[]),
  ];

  return(
    <div className="space-y-5">

      {/* Header */}
      <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
           style={{background:scoreBg(sc),border:`1px solid ${scoreColor(sc)}30`}}>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Borewell Health Card</h2>
          <p className="text-sm text-gray-500 mt-1">
            {d.ward_name} · UID {d.uid}
            {d.data_from&&` · ${String(d.data_from).slice(0,10)} to ${String(d.data_to).slice(0,10)}`}
            {d.days_with_data>0&&` · ${d.days_with_data} days`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportBtn onClick={()=>window.print()}/>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</p>
            <div className="text-center px-5 py-3 rounded-xl border-2"
                 style={{background:rm.bg,borderColor:rm.text+"40",color:rm.text}}>
              <p className="text-4xl font-black">{sc}</p>
              <p className="text-xs font-bold uppercase tracking-wide">out of 100</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grade</p>
            <div className="text-center px-4 py-3 rounded-xl border-2"
                style={{background:rm.bg,color:rm.text,borderColor:rm.text+"40"}}>
              <p className="text-4xl font-black">{rm.icon} {d.health_rating}</p>
              <p className="text-xs font-bold uppercase tracking-widest">{rm.label.toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aquifer parameters FIRST */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-base font-bold text-gray-800">Aquifer parameters</h3>
          <span className="text-xs text-gray-400">— derived from IoT power + TTS data</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FlowTile icon="⬇️" label="Discharge (Qd)" value={fmtDec(d.qd_m_hr,2)} unit="m/hr"
            desc="Water level drops this fast while pumping" color="#dc2626"/>
          <FlowTile icon="⬆️" label="Recharge (Qr)"  value={fmtDec(d.qr_m_hr,2)} unit="m/hr"
            desc="Water level recovers this fast when off"  color="#16a34a"/>
          <FlowTile icon="📏" label="Usable column"   value={fmtDec(d.usable_col_m,1)} unit="m"
            desc={`SWL ${fmtInt(d.static_depth_ft)} ft → Motor ${fmtInt(d.motor_depth_ft)} ft`} color="#2563eb"/>
          <FlowTile icon="🛡️" label="Safe draw (70%)" value={fmtDec(d.safe_draw_m,1)} unit="m"
            desc="30% buffer always kept above motor" color="#d97706"/>
        </div>
      </div>

      {/* Diagram + key stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center sm:col-span-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Borewell cross-section</h3>
          <div className="w-36 h-64">
            <BorewellDiagram
              depth_ft      ={d.borewell_depth||800}
              motor_depth_ft={d.motor_depth_ft||(d.borewell_depth-100)||700}
              swl_ref_ft    ={d.static_depth_ft||d.swl_ref_ft||Math.round((d.borewell_depth||800)*0.35)}
              safe_draw_m   ={d.safe_draw_m||0}
            />
          </div>
        </div>

        <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BigStat icon="⚡" label="Peak Motor Power"
            value={fmtKw(d.max_apparent_power_w)} unit="kW"
            sub="95th pct of clean AP series" color="#2563eb" bg="#eff6ff"/>
          <BigStat icon="💧" label="Flow Rate"
            value={fmtInt(d.rated_lpm)} unit="L/min"
            sub={`${d.motor_hp} HP at ${d.borewell_depth} ft`} color="#16a34a" bg="#f0fdf4"/>
          <BigStat icon="🕐" label="Avg Session"
            value={fmtInt(d.avg_session_dur_min)} unit="min"
            sub={fmtMins(d.avg_session_dur_min)} color="#7c3aed" bg="#f5f3ff"/>
          <BigStat icon="🔁" label="Total ON/OFF Cycles"
            value={fmtInt(d.total_on_off_cycles||d.total_sessions)} unit="cycles"
            sub="Lifetime from device stats" color="#0891b2" bg="#ecfeff"/>
          <BigStat icon="💦" label="Total Water Pumped"
            value={totalWaterKL} unit="kL"
            sub="Last 3 months" color="#16a34a" bg="#f0fdf4"/>
          <BigStat icon="📏" label="Static Water Level (SWL)"
            value={d.static_depth_ft?`${fmtInt(d.static_depth_ft)} ft`:"—"}
            sub={d.static_depth_ft?`${fmtDec(d.static_depth_ft/3.281,1)} m below surface`:"No SWL data"}
            color="#2563eb" bg="#eff6ff"/>
          <BigStat icon="⚠️" label="Overload Trips"
            value={fmtInt(d.total_overload_trips||0)} unit="trips"
            sub="Lifetime from device stats" color="#dc2626" bg="#fef2f2"/>
          <BigStat icon="🔻" label="Underload Trips"
            value={fmtInt(d.total_underload_trips||0)} unit="trips"
            sub="Dry run / low load events" color="#f59e0b" bg="#fffbeb"/>
        </div>
      </div>

      {/* Water level graph */}
      <WaterLevelGraph
        series     ={d.water_level_series||[]}
        staticDepth={d.static_depth_ft||d.swl_ref_ft||0}
        motorDepth ={d.motor_depth_ft||0}
        safeLimit  ={d.safe_draw_m||0}
      />

      {/* Reliability + session breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Reliability indicators</h3>
          <MeterBar label="Recharge factor (Qr/Qd×100)"
            value={Math.min(100,Math.round((d.ratio_qr_qd||0)*100))}
            color="#16a34a" note="Above 70 is healthy"/>
          <MeterBar label="Motor efficiency"
            value={Math.round(d.motor_efficiency_pct||0)}
            color="#2563eb" note="% of rated kW in use"/>
          <MeterBar label="Depletion risk"
            value={Math.round(d.depletion_risk_pct||0)}
            color={d.depletion_risk_pct>60?"#dc2626":d.depletion_risk_pct>30?"#f59e0b":"#16a34a"}
            note="Higher = more risk of over-extraction"/>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Session breakdown</h3>
          {[
            {label:"Avg session duration",    v:`${fmtInt(d.avg_session_dur_min)} min`,  e:fmtMins(d.avg_session_dur_min)},
            {label:"Recharge ratio (Qr/Qd)",  v:fmtDec(d.ratio_qr_qd,2)},
            {label:"Dry run trips",            v:d.dry_run_trips||0},
            {label:"Power failure stops",      v:d.power_fail_trips||0},
            {label:"Avg daily runtime",        v:`${fmtInt(d.avg_daily_runtime_min)} min`,e:fmtMins(d.avg_daily_runtime_min)},
            {label:"Days with data",           v:`${d.days_with_data||0} days`},
            {label:"Total ON/OFF (lifetime)",  v:fmtInt(d.total_on_off_cycles||0)},
            {label:"Total overload trips",     v:fmtInt(d.total_overload_trips||0)},
            {label:"Total underload trips",    v:fmtInt(d.total_underload_trips||0)},
            ...(d.tts_reference?[{label:"Static depth (TTS)",v:`${fmtInt(d.static_depth_ft)} ft`}]:[]),
          ].map(row=>(
            <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-600">{row.label}</span>
              <div className="text-right">
                <span className="text-sm font-bold text-gray-800">{row.v}</span>
                {row.e&&<span className="block text-xs text-gray-400">{row.e}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Detailed rating</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Parameter","Your reading","Ideal","Status","What this means"].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ratingRows.map((r,i)=>(
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-3 font-medium text-gray-700">{r.param}</td>
                  <td className="px-3 py-3 font-bold text-gray-900">{r.value}</td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{r.benchmark}</td>
                  <td className="px-3 py-3"><Badge label={r.ok?"✓ Good":"⚠ Watch"} type={r.ok?"green":"amber"}/></td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-2xl p-5 border-2"
           style={{background:scoreBg(sc),borderColor:scoreColor(sc)+"40"}}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{rm.icon}</span>
          <h3 className="text-base font-bold" style={{color:scoreColor(sc)}}>
            In simple words — Grade {d.health_rating}: {rm.label}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          This borewell scores <strong>{sc}/100</strong>.
          Motor runs ~<strong>{fmtInt(d.avg_session_dur_min)} min ({fmtMins(d.avg_session_dur_min)})</strong> per session.
          Peak power: <strong>{fmtKw(d.max_apparent_power_w)} kW</strong>.
          Flow rate: <strong>{fmtInt(d.rated_lpm)} L/min</strong>.
          {d.static_depth_ft&&` Static water level: ${fmtInt(d.static_depth_ft)} ft below surface.`}
          {" "}Safe draw: <strong>{fmtDec(d.safe_draw_m,1)} m</strong>.
          Total pumped: <strong>{totalWaterKL} kL</strong>.
          {(d.total_on_off_cycles||0)>0&&` Lifetime ON/OFF cycles: ${fmtInt(d.total_on_off_cycles)}.`}
          {(d.dry_run_trips||0)>0&&` ⚠️ ${d.dry_run_trips} dry run trips recorded.`}
          {(d.depletion_risk_pct||0)>60&&" ⚠️ High depletion risk — reduce pumping hours."}
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — PUMPING SCHEDULE
// ══════════════════════════════════════════════════════════════════════════════
function PumpingSchedule({data:d}){
  const sessions=d.session_schedule||[];
  const rules=d.dynamic_rules||[];
  const TOTAL=1440;
  const segs=[];let cur=0;
  sessions.forEach(s=>{
    const[sh,sm]=s.start.split(":").map(Number);
    const sm0=sh*60+sm;
    if(sm0>cur)segs.push({t:"idle",s:cur,e:sm0});
    segs.push({t:"pump",s:sm0,e:sm0+d.safe_pump_min});
    segs.push({t:"rest",s:sm0+d.safe_pump_min,e:sm0+d.safe_pump_min+d.recovery_min});
    cur=sm0+d.safe_pump_min+d.recovery_min;
  });
  if(cur<TOTAL)segs.push({t:"idle",s:cur,e:TOTAL});
  const segColor={pump:"#16a34a",rest:"#93c5fd",idle:"#fef3c7"};
  const totalDailyKL=fmtKl(d.total_daily_yield_l);

  return(
    <div className="space-y-5">
      <div className="bg-[#106f30] rounded-2xl p-5 text-white flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">Recommended Pumping Schedule</h2>
          <p className="text-green-200 text-sm mt-1">{d.ward_name} · UID {d.uid} · {d.motor_hp} HP · {d.borewell_depth} ft</p>
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className="bg-white/20 text-white text-sm font-semibold px-3 py-1 rounded-full">{d.sessions_per_day} sessions/day</span>
            <span className="bg-white/20 text-white text-sm font-semibold px-3 py-1 rounded-full">{d.safe_pump_min} min pump · {d.recovery_min} min rest</span>
          </div>
        </div>
        <button onClick={()=>window.print()}
          className="no-print flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#106f30]
                     bg-white rounded-xl hover:bg-green-50 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
          </svg>
          Export PDF
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BigStat icon="⏱️" label="Safe pump time" value={fmtInt(d.safe_pump_min)} unit="min" sub={fmtMins(d.safe_pump_min)} color="#16a34a" bg="#f0fdf4"/>
        <BigStat icon="🔄" label="Recovery time"  value={fmtInt(d.recovery_min)}  unit="min" sub={fmtMins(d.recovery_min)}  color="#2563eb" bg="#eff6ff"/>
        <BigStat icon="💧" label="Daily yield"     value={totalDailyKL} unit="kL"  sub="All sessions combined" color="#7c3aed" bg="#f5f3ff"/>
        <BigStat icon="👤" label="People served"   value={fmtInt(d.people_served)} unit="people" sub="At 108 LPCD(litres per capita per day) as per BWSSB" color="#d97706" bg="#fffbeb"/>
      </div>

      <div>
        <h3 className="text-base font-bold text-gray-800 mb-3">Aquifer parameters driving this schedule</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FlowTile icon="⬇️" label="Discharge (Qd)" value={fmtDec(d.qd_m_hr,2)} unit="m/hr" desc="Water drops this fast"  color="#dc2626"/>
          <FlowTile icon="⬆️" label="Recharge (Qr)"  value={fmtDec(d.qr_m_hr,2)} unit="m/hr" desc="Recovers this fast"      color="#16a34a"/>
          <FlowTile icon="📏" label="Usable column"   value={fmtDec(d.usable_col_m,1)} unit="m" desc="Total above motor"    color="#2563eb"/>
          <FlowTile icon="🛡️" label="Safe draw (70%)" value={fmtDec(d.safe_draw_m,1)} unit="m" desc="Max draw per session" color="#d97706"/>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-4">How this schedule was derived</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {n:"1",title:"Safe pump window",formula:`(${fmtDec(d.safe_draw_m,1)}m×70%)÷Qd${fmtDec(d.qd_m_hr,2)}=${d.safe_pump_min}min`,note:"Max time before safe limit"},
            {n:"2",title:"Recovery time",   formula:`(${fmtDec(d.safe_draw_m,1)}m×70%)÷Qr${fmtDec(d.qr_m_hr,2)}=${d.recovery_min}min`,note:"Aquifer refill time"},
            {n:"3",title:"Sessions/day",    formula:`1440÷(${d.safe_pump_min}+${d.recovery_min})=${d.sessions_per_day}`,note:"With safety buffer"},
          ].map(item=>(
            <div key={item.n} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-[#106f30] text-white text-xs font-bold flex items-center justify-center">{item.n}</div>
                <p className="text-sm font-semibold text-gray-700">{item.title}</p>
              </div>
              <p className="text-xs font-mono bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 mb-2">{item.formula}</p>
              <p className="text-xs text-gray-500">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-3">24-hour timeline</h3>
        <div className="flex gap-4 text-xs text-gray-500 mb-3 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded inline-block" style={{background:"#16a34a"}}/>Pumping</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded inline-block" style={{background:"#93c5fd"}}/>Recovery</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded inline-block" style={{background:"#fef3c7"}}/>Idle</span>
        </div>
        <div className="flex h-10 rounded-xl overflow-hidden shadow-inner"
              style={{printColorAdjust:"exact",WebkitPrintColorAdjust:"exact"}}>
          {segs.map((seg,i)=>(
            <div key={i} title={seg.t}
              style={{
                width:`${((seg.e-seg.s)/TOTAL*100).toFixed(2)}%`,
                background:segColor[seg.t],
                printColorAdjust:"exact",
                WebkitPrintColorAdjust:"exact"
              }}/>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-300 mt-1.5">
          {["12am","3am","6am","9am","12pm","3pm","6pm","9pm","12am"].map(t=><span key={t}>{t}</span>)}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Recommended daily schedule</h3>
        <div className="space-y-3">
          {sessions.map((s,i)=>(
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all">
              <div className="w-10 h-10 rounded-full bg-[#106f30] text-white font-bold text-sm flex items-center justify-center flex-shrink-0">S{s.session}</div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Start</p><p className="font-bold text-gray-800 text-base">{s.start}</p></div>
                <div><p className="text-xs text-gray-400">Stop pump</p><p className="font-semibold text-gray-700">{s.pump_until}</p></div>
                <div><p className="text-xs text-gray-400">Resume after</p><p className="font-semibold text-gray-500">{s.rest_until}</p></div>
                <div><p className="text-xs text-gray-400">Yield</p><p className="font-bold text-green-700">{fmtKl(s.yield_l)} kL</p></div>
              </div>
              <div className="hidden sm:block text-xs text-gray-400 max-w-[100px] text-right">{s.purpose}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Smart auto-adjustment rules</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rules.map((rule,i)=>{
            const bg={red:"#fef2f2 border-red-200",amber:"#fffbeb border-amber-200"};
            const tc={red:"#dc2626",amber:"#d97706"};
            return(
              <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${bg[rule.severity]||bg.amber}`}>
                <span className="text-lg flex-shrink-0">{rule.severity==="red"?"🚨":"⚠️"}</span>
                <div className="text-xs">
                  <p className="text-gray-600"><span className="font-bold text-gray-700">IF: </span>{rule.condition}</p>
                  <p className="mt-0.5"><span className="font-bold text-gray-700">THEN: </span>
                    <span style={{color:tc[rule.severity]||tc.amber}}>{rule.action}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#106f30] rounded-2xl p-5 text-white">
        <h3 className="text-base font-bold mb-2">📋 In simple words</h3>
        <p className="text-sm text-green-100 leading-relaxed">
          Run the pump <strong className="text-white">{d.sessions_per_day} times a day</strong> for{" "}
          <strong className="text-white">{d.safe_pump_min} min ({fmtMins(d.safe_pump_min)})</strong>, then rest{" "}
          <strong className="text-white">{d.recovery_min} min ({fmtMins(d.recovery_min)})</strong>.
          Total daily yield: <strong className="text-white">{totalDailyKL} kL</strong> —
          enough for <strong className="text-white">{fmtInt(d.people_served)} people</strong>.
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function BoreholeIntelligence(){
  const[tab,setTab]=useState("health");
  const[wards,setWards]=useState([]);
  const[uids,setUids]=useState([]);
  const[selWard,setSelWard]=useState("");
  const[selUid,setSelUid]=useState("");
  const[pumpName,setPumpName]=useState("");
  const[healthData,setHealthData]=useState(null);
  const[scheduleData,setScheduleData]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");

  const HP_DEPTH={5:300,6:300,7:400,7.5:400,8:400,10:600,12.5:800,15:900,17.5:1100,20:1300};
  function depthForHp(hp){
    if(!hp)return"";
    const key=Object.keys(HP_DEPTH).reduce((a,b)=>Math.abs(b-hp)<Math.abs(a-hp)?b:a);
    return HP_DEPTH[key];
  }

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=PRINT_STYLE;
    document.head.appendChild(s);
    return()=>document.head.removeChild(s);
  },[]);

  useEffect(()=>{
    axios.get(`${API}/borewell/wards`)
      .then(r=>setWards(r.data.wards||[]))
      .catch(()=>setError("Failed to load wards."));
  },[]);

  useEffect(()=>{
    if(!selWard){setUids([]);setSelUid("");setPumpName("");return;}
    setSelUid("");setHealthData(null);setScheduleData(null);setPumpName("");
    axios.get(`${API}/borewell/uids/${selWard}`)
      .then(r=>setUids(r.data.uids||[]))
      .catch(()=>setError("Failed to load devices."));
  },[selWard]);

  useEffect(()=>{
    if(!selUid){setPumpName("");return;}
    axios.get(`${API}/borewell/pump-name/${selUid}`)
      .then(r=>setPumpName(r.data.pump_name||"—"))
      .catch(()=>setPumpName("—"));
  },[selUid]);

  useEffect(()=>{
    if(!selUid||!selWard)return;
    setHealthData(null);setScheduleData(null);setError("");
    setLoading(true);
    const p={params:{farm_id:selWard}};
    Promise.all([
      axios.get(`${API}/borewell/health/${selUid}`,p),
      axios.get(`${API}/borewell/schedule/${selUid}`,p),
    ])
      .then(([h,s])=>{setHealthData(h.data);setScheduleData(s.data);})
      .catch(e=>setError(e.response?.data?.detail||"Failed to fetch data."))
      .finally(()=>setLoading(false));
  },[selUid,selWard]);

  const wardOpts=wards.map(w=>({value:w.id,label:w.farm_name}));
  const uidOpts=uids.map(u=>({
    value:String(u.uid),
    label:`${String(u.uid)}${u.motor_hp?` · ${u.motor_hp} HP · ${depthForHp(u.motor_hp)} ft`:""}`,
  }));

  return(
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">🌊 Krishi Hrudya Borewell Intelligence</h1>
            <p className="text-sm text-gray-400 mt-1">Select a ward and device to view health analysis and pumping schedule</p>
          </div>
          <img src="/logo_horizontal.png" alt="KrishiHrudya" className="h-20 w-auto object-contain hidden sm:block no-print"/>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 no-print">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Select device</p>
          <div className="flex flex-wrap gap-4 items-end">
            <SearchSelect label="Ward" value={selWard} onChange={setSelWard}
              options={wardOpts} placeholder="— Select ward —" hint="Search by ward number or name…"/>
            <SearchSelect label="Device UID" value={selUid} onChange={setSelUid}
              options={uidOpts}
              placeholder={selWard?"— Select device —":"Select ward first"}
              disabled={!selWard||uidOpts.length===0}
              hint="Search by last 4 digits of UID…"/>
            {selUid&&(
              <button onClick={()=>{setSelUid("");setHealthData(null);setScheduleData(null);setPumpName("");}}
                className="text-xs text-gray-400 hover:text-red-500 underline self-end pb-2.5 transition-colors">
                Clear
              </button>
            )}
          </div>
          {selUid&&(
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pump Name</span>
              <span className="text-sm font-bold text-[#106f30] bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                {pumpName||"Loading…"}
              </span>
            </div>
          )}
        </div>

        {(healthData||scheduleData||loading)&&!error&&(
          <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-gray-100 w-fit no-print">
            {[{k:"health",l:"🏥 Borewell Health"},{k:"schedule",l:"📅 Pumping Schedule"}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${tab===t.k?"bg-[#106f30] text-white shadow-sm":"text-gray-500 hover:text-gray-800"}`}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        {error&&(
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm flex items-center gap-2">
            <span>⚠️</span>{error}
          </div>
        )}
        {loading&&<Spinner/>}

        {!loading&&tab==="health"   &&healthData   &&
          <HealthCard   data={{...healthData.data,  source:healthData.source}}/>}
        {!loading&&tab==="schedule" &&scheduleData&&
          <PumpingSchedule data={{...scheduleData.data,source:scheduleData.source}}/>}

        {!loading&&!healthData&&!error&&(
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-lg font-semibold text-gray-500">Select a ward and device to begin</p>
            <p className="text-sm mt-2">Only active devices with flowmeter data are shown</p>
          </div>
        )}
      </div>
    </div>
  );
}
