"use client";
import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

function relative(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
  return new Date(value).toLocaleDateString();
}

export default function ActivityLog() {
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  async function load(){ setLoading(true); setError(""); try{const r=await fetch('/api/activity',{cache:'no-store'}); const d=await r.json(); if(!r.ok||!d.ok) throw new Error(d.error||'Unable to load activity.'); setItems(d.activities);}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  return <section className="panel" id="activity">
    <div className="panelHead"><div><span className="eyebrow">ACTIVITY</span><h2>What Brokie OS has done</h2></div><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button></div>
    {error && <div className="managerNotice error">{error}</div>}
    <div className="activityList">
      {loading ? <div className="managerEmpty"><Activity/><span>Loading activity…</span></div> : items.length ? items.map(item=><article key={item.id}><span className={`activityDot ${item.status}`}/><div><strong>{item.title}</strong><p>{item.detail || item.action}</p></div><time>{relative(item.created_at)}</time></article>) : <div className="managerEmpty"><Activity/><span>Your generation and publishing history will appear here.</span></div>}
    </div>
  </section>
}
