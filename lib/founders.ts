export type StarterProduct = {
  id: string;
  title: string;
  type: string;
  price: string;
  frontLabel: string;
  backLabel: string;
  description: string;
  tags: string[];
};

export const foundersProducts: StarterProduct[] = [
  {
    id: "manifesto-tee",
    title: "We Don't Need Money Heavyweight Tee",
    type: "Heavyweight Tee",
    price: "39.99",
    frontLabel: "Small spray-paint mascot",
    backLabel: "WE DON'T NEED MONEY TO BE DANGEROUS.",
    description: "The statement piece of Founders Collection 001. Heavyweight streetwear for people building power before wealth.",
    tags: ["Founders 001", "Dangerous", "Heavyweight Tee", "The Brokie"]
  },
  {
    id: "dangerous-hoodie",
    title: "Dangerous Statement Hoodie",
    type: "Premium Hoodie",
    price: "69.99",
    frontLabel: "Small The Brokie wordmark",
    backLabel: "WE DON'T NEED MONEY TO BE DANGEROUS.",
    description: "A premium black hoodie centered on The Brokie manifesto: confidence, focus, loyalty, and forward motion.",
    tags: ["Founders 001", "Dangerous", "Hoodie", "The Brokie"]
  },
  {
    id: "built-different-tee",
    title: "Built Different Heavyweight Tee",
    type: "Heavyweight Tee",
    price: "39.99",
    frontLabel: "Small lightning mark",
    backLabel: "BUILT DIFFERENT.",
    description: "Minimal front placement with a hard-hitting back statement. Built for work, life, and everything after hours.",
    tags: ["Founders 001", "Built Different", "Heavyweight Tee", "The Brokie"]
  },
  {
    id: "loyalty-tee",
    title: "Backed by Loyalty Tee",
    type: "Heavyweight Tee",
    price: "39.99",
    frontLabel: "Crossed tools mark",
    backLabel: "BACKED BY LOYALTY. BUILT TO LAST.",
    description: "A loyalty-first graphic tee for the people who remember who stood beside them while they were still building.",
    tags: ["Founders 001", "Loyalty", "Heavyweight Tee", "The Brokie"]
  },
  {
    id: "mascot-hat",
    title: "Brokie Mascot Embroidered Hat",
    type: "Embroidered Hat",
    price: "32.99",
    frontLabel: "Spray-paint mascot embroidery",
    backLabel: "Optional small wordmark",
    description: "A clean black hat featuring the Brokie spray-paint mascot in orange and yellow thread.",
    tags: ["Founders 001", "Hat", "Embroidery", "The Brokie"]
  }
];
