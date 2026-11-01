import { mkdirSync } from 'node:fs'
import { chmod } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { config } from '../config.js'
import { BusinessError } from '../errors.js'

const types=new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp'],['image/gif','gif']])
const storage=multer.diskStorage({
  destination:(req,file,done)=>{try{mkdirSync(config.productImageDir,{recursive:true});done(null,config.productImageDir)}catch(error){done(error)}},
  filename:(req,file,done)=>done(null,`${randomUUID()}.${types.get(file.mimetype)}`)
})
export const uploadProductImage=multer({
  storage,
  limits:{fileSize:10*1024*1024,files:1},
  fileFilter:(req,file,done)=>done(types.has(file.mimetype)?null:new BusinessError(400,'INVALID_IMAGE','仅支持 PNG、JPEG、WebP、GIF 图片'),types.has(file.mimetype))
}).single('image')
export const uploadedImageUrl=file=>`/images/uploads/${file.filename}`
export async function publishUploadedImage(file){await chmod(file.path,0o644)}
