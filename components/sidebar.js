"use client";

import {
  Gauge,
  Images,
  PackagePlus,
  PlugZap,
  ShoppingBag,
  Sparkles
} from "lucide-react";

const links = [
  ["Dashboard", Gauge, "#dashboard"],
  ["Founders Builder", PackagePlus, "#builder"],
  ["Design Library", Images, "#designs"],
  ["Products", ShoppingBag, "#products"],
  ["Integrations", PlugZap, "#integrations"],
  ["AI Studio", Sparkles, "#ai"]
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mascot">☹</div>
        <div>
          <strong>the brokie</strong>
          <span>BROKIE OS</span>
        </div>
      </div>

      <nav>
        {links.map(([label, Icon, href], index) => (
          <a className={index === 0 ? "active" : ""} href={href} key={label}>
            <Icon size={18} />
            {label}
          </a>
        ))}
      </nav>

      <div className="sideFooter">
        <strong>WE DON'T NEED MONEY</strong>
        <span>TO BE DANGEROUS.</span>
      </div>
    </aside>
  );
}
