import { rows, one } from '../db/database.js'
import { fail, safeNumber, parseJson } from '../errors.js'
export const productView=p=>({id:String(p.id),name:p.name,subtitle:p.subtitle,category:p.category,description:p.description,image:p.image,priceUnits:safeNumber(p.price_units),active:!!p.is_active,color:['sage','cream','rose'][Number(p.id)%3]})
export function pagination(query={}){
  const page=Number(query.page||1),pageSize=Number(query.pageSize||20)
  if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)fail(400,'INVALID_PAGINATION','分页参数无效')
  return {page,pageSize,offset:(page-1)*pageSize}
}
export async function paginate(db,select,count,args,query,mapper=x=>x){
  const {page,pageSize,offset}=pagination(query)
  const total=safeNumber((await one(db,count,args)).total)
  const data=await rows(db,`${select} LIMIT ${pageSize} OFFSET ${offset}`,args)
  return {items:data.map(mapper),page,pageSize,total}
}
export async function listProducts(db,query={},admin=false){
  const where=[],args=[]
  if(!admin)where.push('is_active=1')
  if(query.keyword){where.push('name LIKE ?');args.push(`%${String(query.keyword).slice(0,100)}%`)}
  if(query.category){where.push('category=?');args.push(String(query.category).slice(0,60))}
  const filter=where.length?` WHERE ${where.join(' AND ')}`:''
  return paginate(db,`SELECT * FROM products${filter} ORDER BY id DESC`,`SELECT COUNT(*) AS total FROM products${filter}`,args,query,productView)
}
export async function getProduct(db,id,admin=false){const p=await one(db,`SELECT * FROM products WHERE id=?${admin?'':' AND is_active=1'}`,[id]);if(!p)fail(404,'NOT_FOUND','商品不存在');return productView(p)}
export async function saveProduct(db,id,input,adminId){
  if(id)await getProduct(db,id,true)
  const fields=[input.name,input.subtitle||'',input.category||'',input.description||'',input.image,input.priceUnits,input.active]
  if(id)await rows(db,'UPDATE products SET name=?,subtitle=?,category=?,description=?,image=?,price_units=?,is_active=? WHERE id=?',[...fields,id])
  else id=String((await rows(db,'INSERT INTO products(name,subtitle,category,description,image,price_units,is_active) VALUES(?,?,?,?,?,?,?)',fields)).insertId)
  await rows(db,'INSERT INTO audit_logs(admin_id,action,target_id,summary) VALUES(?,?,?,?)',[adminId,'product.save',id,input.name])
  return getProduct(db,id,true)
}
export async function getCompany(db){return parseJson((await one(db,'SELECT content FROM company_profile WHERE id=1')).content)}
export async function saveCompany(db,company,adminId){await rows(db,'UPDATE company_profile SET content=? WHERE id=1',[JSON.stringify(company)]);await rows(db,'INSERT INTO audit_logs(admin_id,action,target_id,summary) VALUES(?,?,?,?)',[adminId,'company.save','1','公司介绍更新']);return company}
