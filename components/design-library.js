"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Heart, RefreshCw, Search, Trash2 } from "lucide-react";

export default function DesignLibrary() {
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [query,setQuery]=useState(""); const [favorites,setFavorites]=useState(false);
  async function load(){setLoading(true);setError("");try{const r=await fetch(`/api/designs${favorites?'?favorite=true':''}`,{cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Unable to load designs.');setItems(d.designs)}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[favorites]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(x=>[x.name,x.status,x.product_type,x.prompt].join(' ').toLowerCase().includes(q)):items},[items,query]);
  async function toggle(item){const r=await fetch('/api/designs',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,favorite:!item.favorite})});const d=await r.json();if(d.ok)setItems(v=>v.map(x=>x.id===item.id?d.design:x));}
  async function remove(item){if(!confirm(`Delete ${item.name}?`))return;const r=await fetch(`/api/designs?id=${encodeURIComponent(item.id)}`,{method:'DELETE'});const d=await r.json();if(d.ok)setItems(v=>v.filter(x=>x.id!==item.id));}
  return <section className="panel" id="designs">
    <div className="panelHead"><div><span className="eyebrow">DESIGN LIBRARY 2.0</span><h2>Every generated asset, permanently organized</h2></div><button className="secondary" onClick={load}><RefreshCw size={16}/> Refresh</button></div>
    <div className="libraryToolbar"><div className="productToolbar"><Search size={16}/><input placeholder="Search designs, prompts, status…" value={query} onChange={e=>setQuery(e.target.value)}/></div><button className={favorites?'activeFilter secondary':'secondary'} onClick={()=>setFavorites(v=>!v)}><Heart size={16} fill={favorites?'currentColor':'none'}/> Favorites</button></div>
    {error&&<div className="managerNotice error">{error}</div>}
    {loading?<div className="managerEmpty"><RefreshCw className="spin"/><span>Loading your design library…</span></div>:filtered.length?<div className="designLibraryGrid">{filtered.map(item=><article className="libraryCard" key={item.id}>
      <div className="libraryImage">{item.thumbnail_url?<img src={item.thumbnail_url} alt={item.name}/>:<span>☹</span>}<button className="favoriteButton" onClick={()=>toggle(item)}><Heart size={17} fill={item.favorite?'currentColor':'none'}/></button></div>
      <div className="libraryBody"><div className="libraryMeta"><span>{item.product_type||'Artwork'}</span><span>{item.status}</span></div><h3>{item.name}</h3><p>{item.prompt||'Generated with The Brokie Brand DNA.'}</p><div className="libraryActions">{item.front_artwork_url&&<><a href={item.front_artwork_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open</a><a href={item.front_artwork_url} download><Download size={14}/> PNG</a></>}<button onClick={()=>remove(item)}><Trash2 size={14}/></button></div></div>
    </article>)}</div>:<div className="managerEmpty"><Search/><span>No matching designs yet. Generate one in Foundry.</span></div>}
  </section>
}
