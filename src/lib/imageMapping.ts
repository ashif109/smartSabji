import { Product } from "../types";

/**
 * Maps vegetable names to local image assets.
 * Standardizes filenames to lowercase and removes spaces.
 */
const VEGETABLE_IMAGE_MAP: Record<string, string> = {
  "tomato": "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?q=80&w=800&auto=format&fit=crop",
  "premium tomatoes": "https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?q=80&w=800&auto=format&fit=crop",
  "potato": "https://images.unsplash.com/photo-1518977673155-06f1f82c4639?q=80&w=800&auto=format&fit=crop",
  "potatoes": "https://images.unsplash.com/photo-1518977673155-06f1f82c4639?q=80&w=800&auto=format&fit=crop",
  "onion": "https://images.unsplash.com/photo-1620612643945-e63ca9f34a81?q=80&w=800&auto=format&fit=crop",
  "red onions": "https://images.unsplash.com/photo-1620612643945-e63ca9f34a81?q=80&w=800&auto=format&fit=crop",
  "cabbage": "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=800&auto=format&fit=crop",
  "green cabbage": "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?q=80&w=800&auto=format&fit=crop",
  "spinach": "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=800&auto=format&fit=crop",
  "fresh spinach": "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=800&auto=format&fit=crop",
  "carrot": "https://images.unsplash.com/photo-1444858291040-58f756a3bea6?q=80&w=800&auto=format&fit=crop",
  "carrots": "https://images.unsplash.com/photo-1444858291040-58f756a3bea6?q=80&w=800&auto=format&fit=crop",
  "cauliflower": "https://images.unsplash.com/photo-1510627498534-cf7c9002facc?q=80&w=800&auto=format&fit=crop",
  "okra": "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=800&auto=format&fit=crop",
  "fresh okra": "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?q=80&w=800&auto=format&fit=crop",
  "green chillies": "https://images.unsplash.com/photo-1594411132644-8cb96a1e389e?q=80&w=800&auto=format&fit=crop",
  "bell peppers": "https://images.unsplash.com/photo-1566232392379-afd9298e6a46?q=80&w=800&auto=format&fit=crop",
  "coriander": "https://images.unsplash.com/photo-1588636906981-81d30fb4155b?q=80&w=800&auto=format&fit=crop",
  "bitter gourd": "https://images.unsplash.com/photo-1444491741275-3747c33cc99b?q=80&w=800&auto=format&fit=crop",
  "eggplant": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=800&auto=format&fit=crop",
  "brinjal": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?q=80&w=800&auto=format&fit=crop",
  "ginger": "https://images.unsplash.com/photo-1523920290228-4f321a939b4c?q=80&w=800&auto=format&fit=crop",
  "fresh ginger": "https://images.unsplash.com/photo-1523920290228-4f321a939b4c?q=80&w=800&auto=format&fit=crop",
  "garlic": "https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?q=80&w=800&auto=format&fit=crop",
  "lemon": "https://images.unsplash.com/photo-1590505681460-1d8f3ec187a5?q=80&w=800&auto=format&fit=crop",
  "lemons": "https://images.unsplash.com/photo-1590505681460-1d8f3ec187a5?q=80&w=800&auto=format&fit=crop",
  "green beans": "https://images.unsplash.com/photo-1515471204579-2baacc6ae1f1?q=80&w=800&auto=format&fit=crop",
  "bottle gourd": "https://images.unsplash.com/photo-1592394533824-9440e5d68530?q=80&w=800&auto=format&fit=crop",
  "radish": "https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?q=80&w=800&auto=format&fit=crop",
  "cucumber": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?q=80&w=800&auto=format&fit=crop",
  "pumpkin": "https://images.unsplash.com/photo-1506815444479-bfdb1e96c566?q=80&w=800&auto=format&fit=crop",
  "fenugreek leaves": "https://images.unsplash.com/photo-1548029960-695d127fdd50?q=80&w=800&auto=format&fit=crop",
  "pointed gourd": "https://images.unsplash.com/photo-1628155232233-38819b87893d?q=80&w=800&auto=format&fit=crop",
  "ridged gourd": "https://images.unsplash.com/photo-1594533036625-780c65538eec?q=80&w=800&auto=format&fit=crop",
  "sweet potato": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=800&auto=format&fit=crop",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1610348725531-843dff563e2c?q=80&w=400&auto=format&fit=crop";

/**
 * Returns the mapped image URL for a vegetable name.
 * Falls back to default.webp if no mapping is found.
 */
export function getVegetableImage(productName: string): string {
  const normalizedName = productName.toLowerCase().trim();
  
  // Direct match
  if (VEGETABLE_IMAGE_MAP[normalizedName]) {
    return VEGETABLE_IMAGE_MAP[normalizedName];
  }

  // Keyword match (e.g., "Organic Tomato" -> "tomato")
  const keywords = Object.keys(VEGETABLE_IMAGE_MAP);
  for (const keyword of keywords) {
    if (normalizedName.includes(keyword)) {
      return VEGETABLE_IMAGE_MAP[keyword];
    }
  }

  return DEFAULT_IMAGE;
}

/**
 * Enforces mapped images on a product object.
 */
export function enforceMappedImage(product: Product): Product {
  return {
    ...product,
    imageUrl: getVegetableImage(product.name)
  };
}
