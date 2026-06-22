export type SectionCategory =
  | "home"
  | "store"
  | "product"
  | "cart"
  | "checkout"
  | "account"
  | "orders"
  | "global"
  | "layout"
  | "custom"

export const ROUTE_CATEGORY: Record<string, SectionCategory> = {
  "/": "home",
  "/store": "store",
  "/products/[handle]": "product",
  "/cart": "cart",
  "/checkout": "checkout",
  "/account": "account",
  "/wishlist": "account",
  "/help": "account",
  "/orders/[id]": "orders",
}

export const CATEGORY_LABELS: Record<SectionCategory, string> = {
  home: "Home page sections",
  store: "Store & listing",
  product: "Product detail",
  cart: "Cart",
  checkout: "Checkout",
  account: "Account & auth",
  orders: "Orders",
  global: "Global (all pages)",
  layout: "Layout shells",
  custom: "Custom repo",
}

export const PAGE_ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/store": "Store",
  "/products/[handle]": "Product detail",
  "/cart": "Cart",
  "/checkout": "Checkout",
  "/account": "Account",
  "/wishlist": "Wishlist",
  "/help": "Help",
  "/orders/[id]": "Order detail",
}
