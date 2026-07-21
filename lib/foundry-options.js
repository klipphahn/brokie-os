import { productTypes as sharedProductTypes } from "@/lib/product-types";

export const productTypes = sharedProductTypes;

export const audiences = [
  "The Brokie community",
  "Creators and outsiders",
  "People betting on themselves",
  "Friends winning together",
  "Streetwear collectors"
];

export const visualStyles = [
  "Premium graffiti",
  "Minimal streetwear",
  "Raw streetwear",
  "Bold typographic",
  "Distressed graphic",
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
    id: "signal",
    name: "Signal",
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
    name: "Brokie Energy",
    audience: "The Brokie community",
    style: "Distressed graphic",
    mood: "Defiant",
    placement: "Small left chest + large back",
    palette: "signal",
    prompt: "Create a high-energy Brokie design about collective momentum. Keep the iconography original, confident, and wearable."
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
    name: "Together We Win",
    audience: "Friends winning together",
    style: "Minimal streetwear",
    mood: "Defiant",
    placement: "Minimal front only",
    palette: "blackout",
    prompt: "Create a minimal Together We Win emblem with a hidden Brokie detail that rewards a closer look."
  }
];
