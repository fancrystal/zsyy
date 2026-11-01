const fallbackDetailImages={
  '/images/natto-fresh.png':'/images/natto-fresh-long.jpg',
  '/images/acid-light.png':'/images/acid-light-long.jpg'
}
export const detailImagesFor=product=>Array.isArray(product.detailImages)&&product.detailImages.length?product.detailImages:(fallbackDetailImages[product.image]?[fallbackDetailImages[product.image]]:[])
export const detailImageFor=product=>detailImagesFor(product)[0]||''
