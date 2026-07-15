"use client";

import {
  BrainCircuit,
  Fingerprint,
  Gauge,
  Images,
  LineChart,
  PackagePlus,
  PlugZap,
  Send,
  ShoppingBag,
  Smartphone
} from "lucide-react";
import LogoutButton from "@/components/logout-button";

const links = [
  ["Dashboard", Gauge, "#dashboard"],
  ["Brand DNA", Fingerprint, "#brand-dna"],
  ["Design Library", Images, "#designs"],
  ["Foundry", BrainCircuit, "#ai"],
  ["Design Factory", PackagePlus, "#factory"],
  ["Publisher", Send, "#publisher"],
  ["Shopify Sync", ShoppingBag, "#shopify-manager"],
  ["Storefront", ShoppingBag, "#storefront"],
  ["Analytics", LineChart, "#analytics"],
  ["Command", Smartphone, "/command"],
  ["Collection Builder", PackagePlus, "#builder"],
  ["Publish Center", Send, "#publish"],
  ["Products", ShoppingBag, "#products"],
  ["Activity", PlugZap, "#activity"],
  ["Integrations", PlugZap, "#integrations"]
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

      <LogoutButton />

      <div className="sideFooter">
        <strong>WE DON'T NEED MONEY</strong>
        <span>TO BE DANGEROUS.</span>
      </div>
    </aside>
  );
}
