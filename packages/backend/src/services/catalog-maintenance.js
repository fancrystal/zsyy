import { transaction, one, rows } from '../db/database.js'

export const healthProducts=[
  {name:'百年华汉纳豆鲜醇压片糖果',subtitle:'30g（0.5g×60片）',category:'',description:'百年华汉纳豆鲜醇压片糖果。详细产品资料请查看商品详情长图，并以包装说明为准。',image:'/images/natto-fresh.png',priceUnits:39900},
  {name:'百年华汉酸清轻压片糖果',subtitle:'30g（0.5g×60片）',category:'',description:'百年华汉酸清轻压片糖果。详细产品资料请查看商品详情长图，并以包装说明为准。',image:'/images/acid-light.png',priceUnits:39900}
]

export async function syncHealthProducts(db){return transaction(db,async conn=>{
  const ids=[]
  for(const product of healthProducts){
    const existing=await one(conn,'SELECT id FROM products WHERE name=?',[product.name])
    if(existing){await rows(conn,'UPDATE products SET subtitle=?,category=?,description=?,image=?,price_units=?,is_active=1 WHERE id=?',[product.subtitle,product.category,product.description,product.image,product.priceUnits,existing.id]);ids.push(String(existing.id))}
    else ids.push(String((await rows(conn,'INSERT INTO products(name,subtitle,category,description,image,price_units,is_active) VALUES(?,?,?,?,?,?,1)',[product.name,product.subtitle,product.category,product.description,product.image,product.priceUnits])).insertId))
  }
  await rows(conn,`UPDATE products SET is_active=0 WHERE id NOT IN (${ids.map(()=>'?').join(',')})`,ids)
  return healthProducts.map((product,index)=>({id:ids[index],...product,active:true}))
})}
