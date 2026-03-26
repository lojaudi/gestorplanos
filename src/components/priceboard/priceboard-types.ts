export interface HighlightProduct {
  name: string;
  price: string;
  unit: string;
  imageUrl: string | null;
}

export interface ProductRow {
  id: string;
  name: string;
  price: string;
  unit: string;
}

export interface PriceBoardLayout {
  id: string;
  name: string;
  thumbnail: string;
  bgColor: string;
  bgGradient: string;
  headerBg: string;
  headerColor: string;
  rowBg: string;
  rowAltBg: string;
  rowTextColor: string;
  priceColor: string;
  highlightBg: string;
  highlightTextColor: string;
  priceBadgeBg: string;
  priceBadgeColor: string;
  accentColor: string;
  tableBorderColor: string;
}

export interface PriceBoardState {
  layoutId: string;
  title: string;
  subtitle: string;
  highlightProduct: HighlightProduct;
  products: ProductRow[];
  logoUrl: string | null;
  showDate: boolean;
  highlightSize: number; // percentage width for highlight section
}

export const DEFAULT_PRODUCTS: ProductRow[] = [
  { id: "1", name: "PRODUTO 1", price: "0,00", unit: "KG" },
  { id: "2", name: "PRODUTO 2", price: "0,00", unit: "KG" },
  { id: "3", name: "PRODUTO 3", price: "0,00", unit: "KG" },
  { id: "4", name: "PRODUTO 4", price: "0,00", unit: "KG" },
  { id: "5", name: "PRODUTO 5", price: "0,00", unit: "KG" },
  { id: "6", name: "PRODUTO 6", price: "0,00", unit: "KG" },
];
