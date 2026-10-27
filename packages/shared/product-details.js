const detailImages={
  '/images/natto-fresh.png':'/images/natto-fresh-long.jpg',
  '/images/acid-light.png':'/images/acid-light-long.jpg'
}
export const detailImageFor=product=>detailImages[product.image]||''
