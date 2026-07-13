"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, LoaderCircle, RefreshCw, Save, Send, ShoppingBag, TriangleAlert } from "lucide-react";

function normalize(item) {
  const c=item.concept||{}; const p=item.product||{};
  return { ...item, form: {
    title:p.title||c.title||item.design.name||"",
    description:p.description||c.description||"",
    productType:p.product_type||c.productType||"Apparel",
    price:String(p.retail_price||c.price||39.99),
    tags:(p.tags||c.tags||["The Brokie"]).join(", "),
    seoTitle:p.seo_title||c.seoTitle||c.title||item.design.name||"",
    metaDescription:p.meta_description||c.metaDescription||c.description||""
  }};
}

export default function Publisher() {
  const [items,setItems]=useState([]); const [selected,setSelected]=useState(0); const [loading,setLoading]=useState(true); const [working,setWorking]=useState(""); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  async function load(){setLoading(true);setError("");try{const r=await fetch('/api/publisher',{cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Unable to load publisher.');setItems((d.items||[]).map(normalize));}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  const current=items[selected];
  function patch(key,value){setItems(v=>v.map((item,i)=>i===selected?{...item,form:{...item.form,[key]:value}}:item))}
  async function act(action){if(!current)return;setWorking(action);setMessage("");setError("");try{const r=await fetch('/api/publisher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,designId:current.design.id,...current.form,tags:current.form.tags.split(',').map(x=>x.trim()).filter(Boolean)})});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Publisher action failed.');setMessage(d.message);await load();}catch(e){setError(e.message)}finally{setWorking("")}}
  const steps=useMemo(()=>{if(!current)return[];const p=current.product||{};return [
    ['Artwork ready',Boolean(current.concept.artworkUrl)],
    ['Metadata reviewed',['review','shopify_draft','active'].includes(p.status)||['approved','ready','published'].includes(current.design.status)],
    ['Shopify draft',Boolean(p.shopify_product_id)],
    ['Printful configured',p.printful_status==='configured'],
    ['Shopify active',p.status==='active']
  ]},[current]);
  return <section className="panel publisherPanel" id="publisher">
    <div className="panelHead"><div><span className="eyebrow">PUBLISHER V1.7</span><h2>Review, draft, and activate</h2></div><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={16}/>Refresh</button></div>
    <div className="publisherNotice"><TriangleAlert size={18}/><span>Shopify publishing is automated. Printful cannot be attached automatically to your Shopify-connected Printful store through the product API, so fulfillment remains a required manual checkpoint before accepting orders.</span></div>
    {error&&<div className="managerNotice error">{error}</div>}{message&&<div className="managerNotice success">{message}</div>}
    {loading?<div className="managerEmpty"><LoaderCircle className="spin"/>Loading publisher…</div>:items.length?<div className="publisherLayout">
      <div className="publisherQueue">{items.map((item,index)=><button key={item.design.id} className={index===selected?'activePublishItem':''} onClick={()=>setSelected(index)}><img src={item.concept.artworkUrl||item.design.thumbnail_url||''} alt=""/><span><b>{item.form.title}</b><small>{item.product?.status||item.design.status}</small></span></button>)}</div>
      {current&&<div className="reviewWorkspace">
        <div className="reviewTop"><div className="reviewArtwork"><img src={current.concept.artworkUrl||current.design.thumbnail_url||''} alt=""/></div><div className="publishChecklist">{steps.map(([label,done])=><div key={label}>{done?<CheckCircle2/>:<CircleDashed/>}<span>{label}</span></div>)}</div></div>
        <div className="reviewFields"><label>Product title<input value={current.form.title} onChange={e=>patch('title',e.target.value)}/></label><label>Product type<input value={current.form.productType} onChange={e=>patch('productType',e.target.value)}/></label><label className="fullField">Description<textarea value={current.form.description} onChange={e=>patch('description',e.target.value)}/></label><label>Retail price<input value={current.form.price} onChange={e=>patch('price',e.target.value)}/></label><label>Tags<input value={current.form.tags} onChange={e=>patch('tags',e.target.value)}/></label><label>SEO title<input value={current.form.seoTitle} onChange={e=>patch('seoTitle',e.target.value)}/></label><label>Meta description<input value={current.form.metaDescription} onChange={e=>patch('metaDescription',e.target.value)}/></label></div>
        <div className="publisherActions"><button className="secondary" onClick={()=>act('save_review')} disabled={!!working}><Save size={16}/>{working==='save_review'?'Saving…':'Save review'}</button><button onClick={()=>act('create_shopify_draft')} disabled={!!working}><ShoppingBag size={16}/>{working==='create_shopify_draft'?'Creating…':current.product?.shopify_product_id?'Update Shopify draft':'Create Shopify draft'}</button><button className="activateButton" onClick={()=>act('activate_shopify')} disabled={!!working||!current.product?.shopify_product_id}><Send size={16}/>{working==='activate_shopify'?'Activating…':'Activate in Shopify'}</button>{current.product?.shopify_admin_url&&<a href={current.product.shopify_admin_url} target="_blank" rel="noreferrer">Open in Shopify <ExternalLink size={14}/></a>}</div>
      </div>}
    </div>:<div className="managerEmpty">Generate designs in Foundry first.</div>}
  </section>
}
