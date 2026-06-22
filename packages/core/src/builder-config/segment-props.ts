/** Maps segment package name → workflow output key — mirrors framework-runtime segment-props. */
const SEGMENT_DATA_KEYS: Record<string, string> = {
  "@pradip1995/segment-hero": "hero",
  "@pradip1995/segment-shop-by-age": "shopByAge",
  "@pradip1995/segment-shop-by-category": "shopByCategory",
  "@pradip1995/segment-why-choose-us": "whyChooseUs",
  "@pradip1995/segment-new-arrivals": "newArrivals",
  "@pradip1995/segment-loved-by-moms": "lovedByMoms",
  "@pradip1995/segment-testimonials": "testimonials",
  "@pradip1995/segment-features": "features",
  "@pradip1995/segment-promotional-banners": "promotionalBanners",
  "@pradip1995/segment-collections-showcase": "collectionsShowcase",
  "@pradip1995/segment-bestsellers-carousel": "bestsellers",
  "@pradip1995/segment-reviews-marquee": "testimonials",
  "@pradip1995/segment-nav": "nav",
  "@pradip1995/segment-footer": "footer",
  "@pradip1995/segment-promo-bar": "promoBar",
  "@pradip1995/segment-product-grid": "store",
  "@pradip1995/segment-refinement-list": "store",
  "@pradip1995/segment-mobile-filters": "store",
  "@pradip1995/segment-product-gallery": "product",
  "@pradip1995/segment-product-info": "product",
  "@pradip1995/segment-product-actions": "product",
  "@pradip1995/segment-related-products": "relatedProducts",
  "@pradip1995/segment-cart-item": "cartPage",
  "@pradip1995/segment-cart-summary": "cartPage",
  "@pradip1995/segment-checkout-form": "checkout",
  "@pradip1995/segment-checkout-summary": "checkout",
  "@pradip1995/segment-login-template": "account",
  "@pradip1995/segment-login": "account",
  "@pradip1995/segment-register": "account",
  "@pradip1995/segment-forgot-password": "account",
  "@pradip1995/segment-google-login": "account",
  "@pradip1995/segment-order-details": "orderPage",
  "@pradip1995/segment-wishlist": "wishlistPage",
  "@pradip1995/segment-help": "helpPage",
}

export function getSegmentProps(
  segmentPkg: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const key = SEGMENT_DATA_KEYS[segmentPkg]
  if (!key) return data
  const value = data[key]
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return { [key]: value }
}
