import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { config } from './config.js'
import { one, rows } from './db/database.js'
import { fail } from './errors.js'
import * as accounts from './services/accounts.js'
import * as catalog from './services/catalog.js'
import * as accounting from './services/accounting.js'
import * as queries from './services/queries.js'
import { reconcile } from './services/reconcile.js'
const id=z.string().regex(/^\d+$/).max(20),text=(max)=>z.string().trim().min(1).max(max)
const money=z.number().int().positive().max(1000000000000)
const image=z.string().max(1000).refine(s=>/^\/images\/[a-zA-Z0-9_./-]+$/.test(s)||/^https?:\/\/[^\s]+$/i.test(s),'图片地址必须为 http/https URL 或 /images/ 路径')
const productSchema=z.object({name:text(100),subtitle:z.string().trim().max(100).default(''),category:z.string().trim().max(60).default(''),description:z.string().max(5000).default(''),image,priceUnits:money,active:z.boolean().default(true)}).strict()
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next)
export function createApp(db,options={}){
  const app=express(),secrets={user:options.userSecret||config.userSecret,admin:options.adminSecret||config.adminSecret}
  app.disable('x-powered-by');app.set('trust proxy','loopback');app.use(express.json({limit:'128kb'}));app.use(cookieParser())
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`${req.protocol}://${req.get('host')}`)return next(Object.assign(new Error('请求来源无效'),{status:403,code:'INVALID_ORIGIN'}));next()})
  const body=(req,schema)=>schema.parse(req.body),pathId=req=>id.parse(req.params.id)
  const key=req=>text(80).parse(req.get('Idempotency-Key'))
  const send=(res,data,status=200)=>res.status(status).json({data})
  const requireRole=role=>asyncRoute(async(req,res,next)=>{try{const token=jwt.verify(req.cookies[`zsyy_${role}`],secrets[role],{algorithms:['HS256'],issuer:'zsyy',audience:role});req.identity=token.sub
    if(role==='admin'&&!await one(db,'SELECT id FROM admin_users WHERE id=? AND enabled=1',[req.identity]))fail(401,'UNAUTHENTICATED','请重新登录')
  }catch{fail(401,'UNAUTHENTICATED',role==='admin'?'请先登录管理后台':'请先登录')}
    next()
  })
  const loginCookie=(res,role,user)=>{const token=jwt.sign({},secrets[role],{subject:String(user.id),issuer:'zsyy',audience:role,expiresIn:'12h'});res.cookie(`zsyy_${role}`,token,{httpOnly:true,sameSite:'strict',secure:config.production,maxAge:12*3600000,path:'/api'})}
  const loginSchema=z.object({username:text(50),password:z.string().min(1).max(72)}).strict()
  const limiter=rateLimit({windowMs:15*60*1000,limit:100,standardHeaders:true,legacyHeaders:false,message:{error:{code:'RATE_LIMITED',message:'尝试过于频繁，请稍后重试'}}})
  app.post(['/api/auth/login','/api/auth/register','/api/admin/auth/login'],limiter)
  app.get('/api/health',asyncRoute(async(req,res)=>{await one(db,'SELECT 1');send(res,{status:'ok',database:'connected'})}))
  app.get('/api/company',asyncRoute(async(req,res)=>send(res,await catalog.getCompany(db))))
  app.get('/api/products',asyncRoute(async(req,res)=>send(res,await catalog.listProducts(db,req.query))))
  app.get('/api/products/:id',asyncRoute(async(req,res)=>send(res,await catalog.getProduct(db,pathId(req)))))
  app.get('/api/categories',asyncRoute(async(req,res)=>send(res,(await rows(db,"SELECT DISTINCT category FROM products WHERE is_active=1 AND category<>'' ORDER BY category")).map(r=>r.category))))
  app.post('/api/auth/register',asyncRoute(async(req,res)=>{const input=body(req,z.object({username:z.string().trim().regex(/^1[3-9]\d{9}$/),password:z.string().min(6).max(72),nickname:text(60),inviteCode:text(32)}).strict());const user=await accounts.register(db,input);loginCookie(res,'user',user);send(res,user,201)}))
  for(const role of ['user','admin']){
    const base=role==='admin'?'/api/admin/auth':'/api/auth'
    app.post(`${base}/login`,asyncRoute(async(req,res)=>{const input=body(req,loginSchema),user=await accounts.login(db,input.username,input.password,role==='admin');loginCookie(res,role,user);send(res,user)}))
    app.post(`${base}/logout`,(req,res)=>{res.clearCookie(`zsyy_${role}`,{path:'/api',httpOnly:true,sameSite:'strict',secure:config.production});send(res,{ok:true})})
  }
  app.use('/api/me',requireRole('user'))
  app.get('/api/me',asyncRoute(async(req,res)=>send(res,await accounts.me(db,req.identity))))
  app.patch('/api/me',asyncRoute(async(req,res)=>{const input=body(req,z.object({nickname:text(60)}).strict());await rows(db,'UPDATE users SET nickname=? WHERE id=?',[input.nickname,req.identity]);send(res,await accounts.me(db,req.identity))}))
  app.get('/api/me/address',asyncRoute(async(req,res)=>send(res,await accounts.getAddress(db,req.identity))))
  app.put('/api/me/address',asyncRoute(async(req,res)=>send(res,await accounts.saveAddress(db,req.identity,body(req,z.object({recipient:text(60),phone:z.string().regex(/^1\d{10}$/),detail:text(500)}).strict())))))
  app.get('/api/me/wallet',asyncRoute(async(req,res)=>send(res,await accounting.wallet(db,req.identity))))
  app.get('/api/me/wallet/ledger',asyncRoute(async(req,res)=>send(res,await accounting.ledger(db,req.identity,req.query))))
  app.get('/api/me/team',asyncRoute(async(req,res)=>send(res,await queries.teamInfo(db,req.identity))))
  app.get('/api/me/rebates',asyncRoute(async(req,res)=>send(res,await queries.rebates(db,req.query,req.identity))))
  app.use('/api/orders',requireRole('user'))
  app.get('/api/orders',asyncRoute(async(req,res)=>send(res,await accounting.listOrders(db,req.query,req.identity))))
  app.get('/api/orders/:id',asyncRoute(async(req,res)=>send(res,await accounting.getOrder(db,pathId(req),req.identity))))
  app.post('/api/orders',asyncRoute(async(req,res)=>{const input=body(req,z.object({productId:id,quantity:z.number().int().min(1).max(999),expectedPriceUnits:money}).strict());const data=await accounting.purchase(db,req.identity,input,key(req));send(res,data,data.replayed?200:201)}))
  app.use('/api/admin',requireRole('admin'))
  app.get('/api/admin/me',asyncRoute(async(req,res)=>send(res,await one(db,'SELECT CAST(id AS CHAR) AS id,username FROM admin_users WHERE id=?',[req.identity]))))
  app.get('/api/admin/overview',asyncRoute(async(req,res)=>send(res,await queries.overview(db))))
  app.get('/api/admin/company',asyncRoute(async(req,res)=>send(res,await catalog.getCompany(db))))
  app.put('/api/admin/company',asyncRoute(async(req,res)=>send(res,await catalog.saveCompany(db,body(req,z.object({name:text(40),tagline:text(60),intro:text(2000),body:z.string().max(10000),images:z.array(image).max(10).default([])}).strict()),req.identity))))
  app.get('/api/admin/products',asyncRoute(async(req,res)=>send(res,await catalog.listProducts(db,req.query,true))))
  app.post('/api/admin/products',asyncRoute(async(req,res)=>send(res,await catalog.saveProduct(db,null,body(req,productSchema),req.identity),201)))
  app.patch('/api/admin/products/:id',asyncRoute(async(req,res)=>{const old=await catalog.getProduct(db,pathId(req),true),patch=body(req,productSchema.partial());const {id:ignoredId,color:ignoredColor,...base}=old;send(res,await catalog.saveProduct(db,pathId(req),productSchema.parse({...base,...patch}),req.identity))}))
  app.get('/api/admin/users',asyncRoute(async(req,res)=>send(res,await queries.users(db,req.query))))
  app.get('/api/admin/users/:id',asyncRoute(async(req,res)=>send(res,await queries.userDetail(db,pathId(req)))))
  app.get('/api/admin/users/:id/wallet/ledger',asyncRoute(async(req,res)=>send(res,await accounting.ledger(db,pathId(req),req.query))))
  app.get('/api/admin/users/:id/team',asyncRoute(async(req,res)=>send(res,await queries.teamInfo(db,pathId(req)))))
  app.post('/api/admin/users/:id/voucher-grants',asyncRoute(async(req,res)=>{const userId=pathId(req);await accounts.me(db,userId);const data=await accounting.grant(db,req.identity,userId,body(req,z.object({amountUnits:money,note:text(500)}).strict()),key(req));send(res,data,data.replayed?200:201)}))
  app.get('/api/admin/orders',asyncRoute(async(req,res)=>send(res,await accounting.listOrders(db,req.query))))
  app.get('/api/admin/orders/:id',asyncRoute(async(req,res)=>send(res,await accounting.getOrder(db,pathId(req)))))
  app.get('/api/admin/rebates',asyncRoute(async(req,res)=>send(res,await queries.rebates(db,req.query))))
  app.get('/api/admin/job-runs',asyncRoute(async(req,res)=>send(res,await queries.jobRuns(db,req.query))))
  app.get('/api/admin/reconciliation-issues',asyncRoute(async(req,res)=>send(res,await queries.issues(db,req.query))))
  app.post('/api/admin/jobs/reconcile',asyncRoute(async(req,res)=>send(res,await reconcile(db,`manual:${key(req)}`))))
  app.use((req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'接口不存在'}}))
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error)
    if(error instanceof z.ZodError)return res.status(400).json({error:{code:'INVALID_INPUT',message:'输入不符合要求，请检查必填字段和格式'}})
    if(error.type==='entity.parse.failed')return res.status(400).json({error:{code:'INVALID_JSON',message:'请求内容不是有效 JSON'}})
    const status=error.status||500
    if(status===500)console.error('API failure:',error.code||error.name)
    res.status(status).json({error:{code:error.code||'INTERNAL_ERROR',message:status===500?'服务暂时不可用，请稍后重试':error.message}})
  })
  return app
}
