import { productTypes as sharedProductTypes } from "@/lib/product-types";

export const productTypes = sharedProductTypes;

export const audiences = [
  "Blue-collar builders",
  "Union electricians",
  "Working dads",
  "Creators building after hours",
  "People rebuilding their lives",
  "Streetwear collectors"
];

export const visualStyles = [
  "Premium graffiti",
  "Minimal streetwear",
  "Vintage workwear",
  "Bold typographic",
  "Distressed industrial",
  "Clean emblem"
];

export const moods = [
  "Dangerous",
  "Relentless",
  "Defiant",
  "Loyal",
  "Focused",
  "Dark humor"
];

export const placements = [
  "Small left chest + large back",
  "Large centered front",
  "Minimal front only",
  "Back statement + sleeve detail",
  "Center chest emblem"
];

export const palettes = [
  {
    id: "brokie-core",
    name: "Brokie Core",
    colors: ["#080808", "#FF4F00", "#FFC107", "#FFFFFF"]
  },
  {
    id: "blackout",
    name: "Blackout",
    colors: ["#050505", "#333333", "#FFFFFF"]
  },
  {
    id: "safety",
    name: "Jobsite",
    colors: ["#0B0B0B", "#FF6A00", "#FFD400"]
  },
  {
    id: "concrete",
    name: "Concrete",
    colors: ["#111111", "#7D7D7D", "#E6E6E6", "#FF4F00"]
  }
];

export const foundryPresets = [
  {
    name: "Live Wire",
    audience: "Union electricians",
    style: "Distressed industrial",
    mood: "Relentless",
    placement: "Small left chest + large back",
    palette: "safety",
    prompt: "Build an electrician design around earned power, current, overtime, and pride in skilled work. Avoid generic lightning clipart."
  },
  {
    name: "Still Building",
    audience: "People rebuilding their lives",
    style: "Premium graffiti",
    mood: "Defiant",
    placement: "Small left chest + large back",
    palette: "brokie-core",
    prompt: "Create a statement for people who are not finished yet. Make it emotional, restrained, and wearable—not motivational-poster copy."
  },
  {
    name: "Backed by Loyalty",
    audience: "Blue-collar builders",
    style: "Minimal streetwear",
    mood: "Loyal",
    placement: "Minimal front only",
    palette: "blackout",
    prompt: "Create a minimal loyalty emblem with a hidden detail that rewards a closer look."
  }
];
