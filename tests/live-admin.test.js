import { test, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Console from '../packages/admin/src/Console.vue'
let wrapper
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
const click=async text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);expect(b).toBeTruthy();b.click();await flushPromises()}
test('administrator signs in, creates a real product through API, and can sign out',async()=>{
  const products=[]
  vi.stubGlobal('fetch',async(url,options={})=>{
    if(url==='/api/admin/me')return new Response(JSON.stringify({error:{message:'请登录'}}),{status:401})
    let data={}
    if(url==='/api/admin/auth/login')data={id:'1',username:'admin'}
    else if(url.startsWith('/api/admin/products')){
      if(options.method==='POST'){const p=JSON.parse(options.body);products.push({...p,id:'9'});data=products[0]}else data={items:products,page:1,pageSize:20,total:products.length}
    }else if(url.startsWith('/api/admin/orders'))data={items:[],total:0}
    else if(url==='/api/admin/overview')data={users:0,orders:0,products:0,spentUnits:0,rebateUnits:0}
    return new Response(JSON.stringify({data}),{status:200})
  })
  wrapper=mount(Console,{attachTo:document.body});await flushPromises()
  await wrapper.get('input[autocomplete="username"]').setValue('admin');await wrapper.get('input[type="password"]').setValue('valid-password-2026');await wrapper.get('form').trigger('submit');await flushPromises()
  expect(document.querySelector('nav[aria-label="后台菜单"]')).not.toBeNull()
  await click('商品管理');await click('新增商品')
  for(const [name,value] of [['name','新建测试商品'],['price','12.50'],['image','/images/shampoo.png']]){const input=document.querySelector(`dialog input[name="${name}"]`);expect(input).not.toBeNull();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}
  document.querySelector('dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flushPromises()
  expect(document.body.textContent).toContain('新建测试商品');expect(document.querySelector('dialog')).toBeNull();expect(products[0].priceUnits).toBe(1250)
  await click('退出登录');expect(document.querySelector('input[type="password"]')).not.toBeNull()
})
