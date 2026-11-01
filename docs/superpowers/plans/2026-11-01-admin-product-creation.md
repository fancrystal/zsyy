# 券商城后台商品添加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让券商城后台能够上传商品封面和详情图、维护排序，并在移动端商品详情展示详情图片。

**Architecture:** 在现有 `products` 表上增加 `detail_images` 与 `sort_order`，保持产品券价格和订单快照模型不变。Express 管理员接口处理图片上传，商品接口传递新字段；后台表单使用可复用图片编辑器，移动端详情页按顺序渲染详情图。

**Tech Stack:** Node.js、Express、MySQL、Multer、Vue 3、Vite、Element Plus、Node Test、Vitest、Nginx。

## Global Constraints

- 仅管理员可上传、创建和编辑商品。
- 仅 PNG、JPEG、WebP、GIF，单文件不超过 10 MB。
- 详情图最多 30 张；图片地址必须是 `/images/...` 或 `http/https`。
- 不新增库存、佣金、VIP、代理、本地商圈或删除商品能力。
- 产品券金额保持最小单位整数；前台输入与展示精确到 0.01 券。

---

### Task 1: 商品数据字段与接口校验

**Files:**
- Modify: `packages/backend/src/db/schema.js`
- Modify: `packages/backend/src/services/catalog.js`
- Modify: `packages/backend/src/app.js`
- Test: `packages/backend/tests/api.test.mjs`

**Interfaces:**
- Produces `productView(product)` 的 `detailImages: string[]` 与 `sortOrder: number`。
- 管理员 `POST/PATCH /api/admin/products` 接受 `detailImages` 和 `sortOrder`。

- [ ] **Step 1: 写入失败测试**

```js
const created=await admin.post('/api/admin/products').send({
  name:'详情图商品',priceUnits:12800,image:'/images/shampoo.png',
  detailImages:['/images/bodywash.png'],sortOrder:9,active:true
})
assert.equal(created.status,201)
assert.deepEqual(created.body.data.detailImages,['/images/bodywash.png'])
assert.equal(created.body.data.sortOrder,9)
```

- [ ] **Step 2: 运行后端测试，确认字段尚未保存而失败**

Run: `npm.cmd run test:backend -- --test-name-pattern "product detail images"`

Expected: FAIL，因为响应未包含详情图和排序。

- [ ] **Step 3: 实现迁移、视图映射、按排序查询与 Zod 校验**

```js
const detailImages=z.array(image).max(30).default([])
const sortOrder=z.number().int().min(0).max(2147483647).default(0)
```

将 `detail_images JSON NOT NULL` 与 `sort_order INT NOT NULL DEFAULT 0` 加入建表与兼容迁移；保存时使用 `JSON.stringify(detailImages)`；列表排序为 `sort_order DESC, id DESC`。

- [ ] **Step 4: 重跑目标测试并确认通过**

Run: `npm.cmd run test:backend -- --test-name-pattern "product detail images"`

Expected: PASS。

- [ ] **Step 5: 提交数据与商品接口变更**

```bash
git add packages/backend/src/db/schema.js packages/backend/src/services/catalog.js packages/backend/src/app.js packages/backend/tests/api.test.mjs
git commit -m "feat: add product detail images and sorting"
```

### Task 2: 管理员图片上传接口

**Files:**
- Modify: `packages/backend/package.json`
- Modify: `packages/backend/src/app.js`
- Modify: `packages/backend/tests/api.test.mjs`
- Create: `packages/backend/src/services/product-images.js`
- Modify: `packages/backend/src/config.js`
- Modify: `packages/backend/src/index.js`
- Modify: `packages/mobile-h5/vite.config.js`
- Modify: `packages/admin/vite.config.js`

**Interfaces:**
- Produces `POST /api/admin/product-images`，返回 `{url:'/images/uploads/<uuid>.<extension>'}`。
- 消费 `multipart/form-data` 字段 `image`。

- [ ] **Step 1: 写入失败测试**

```js
const upload=await admin.post('/api/admin/product-images')
  .attach('image',Buffer.from('png'),{filename:'cover.png',contentType:'image/png'})
assert.equal(upload.status,201)
assert.match(upload.body.data.url,/^\/images\/uploads\/.+\.png$/)
```

- [ ] **Step 2: 运行测试，确认路由不存在而失败**

Run: `npm.cmd run test:backend -- --test-name-pattern "product image upload"`

Expected: FAIL with 404。

- [ ] **Step 3: 使用 Multer 实现受限上传与稳定文件路径**

```js
const allowed=new Map([['image/png','png'],['image/jpeg','jpg'],['image/webp','webp'],['image/gif','gif']])
```

文件写入由 `PRODUCT_IMAGE_DIR` 配置决定，开发默认写入 `packages/mobile-h5/public/images/uploads`；生产使用持久化目录 `/var/lib/zsyy/product-images`。随机 UUID 文件名避免覆盖；拒绝未认证、错误 MIME 类型和超过 10 MB 的文件。后端开发服务通过 `/images/uploads/` 静态暴露目录，两个 Vite 开发服务器代理该路径到后端。

- [ ] **Step 4: 重跑上传、鉴权和格式拒绝测试**

Run: `npm.cmd run test:backend -- --test-name-pattern "product image upload"`

Expected: PASS。

- [ ] **Step 5: 提交上传接口**

```bash
git add packages/backend/package.json packages/backend/src/app.js packages/backend/src/services/product-images.js packages/backend/tests/api.test.mjs
git commit -m "feat: add admin product image uploads"
```

### Task 3: 后台商品表单与图片编辑

**Files:**
- Create: `packages/admin/src/components/ProductImageEditor.vue`
- Modify: `packages/admin/src/views/ProductsView.vue`
- Test: `tests/ui-audit.test.js`

**Interfaces:**
- `ProductImageEditor` 使用 `v-model` 管理图片地址数组，支持最多 30 张详情图和封面单图。
- 商品保存请求包含 `detailImages` 与 `sortOrder`。

- [ ] **Step 1: 写入失败界面测试**

```js
expect(document.body.textContent).toContain('详情图片')
expect(document.querySelector('input[name="sortOrder"]')).toBeTruthy()
```

- [ ] **Step 2: 运行 UI 测试，确认表单字段尚不存在而失败**

Run: `npm.cmd run test:ui -- --runInBand`

Expected: FAIL，因为表单没有详情图或排序输入。

- [ ] **Step 3: 实现图片编辑器与扩展表单**

封面支持粘贴路径或上传；详情图支持添加、删除、上移和下移。上传与保存过程中禁用重复提交，表单错误保留输入。

- [ ] **Step 4: 重跑 UI 测试**

Run: `npm.cmd run test:ui`

Expected: PASS。

- [ ] **Step 5: 提交后台页面变更**

```bash
git add packages/admin/src/components/ProductImageEditor.vue packages/admin/src/views/ProductsView.vue tests/ui-audit.test.js
git commit -m "feat: add admin product image editor"
```

### Task 4: 移动端详情图展示与发布

**Files:**
- Modify: `packages/mobile-h5/src/views/MallView.vue`
- Modify: `shared/product-details.js`
- Test: `tests/ui-audit.test.js`
- Modify: `deploy/zsyy.production.conf`
- Modify: `deploy/provision-zsyy-production.sh`

**Interfaces:**
- 商品详情在 `product.detailImages` 非空时按数组顺序展示图片。

- [ ] **Step 1: 写入失败 UI 测试**

```js
expect(document.querySelectorAll('[data-product-detail-image]').length).toBe(2)
```

- [ ] **Step 2: 运行测试，确认详情图未渲染而失败**

Run: `npm.cmd run test:ui`

Expected: FAIL。

- [ ] **Step 3: 最小化实现详情图渲染与静态资源映射**

仅在存在 `product.detailImages` 时渲染图片区，不影响无详情图商品的现有页面。删除健康商品临时使用的单图映射，改为由商品数据驱动。两个生产虚拟主机均将 `/images/uploads/` 映射到 `/var/lib/zsyy/product-images/`，部署脚本创建该持久化目录但发布包不覆盖其中的文件。

- [ ] **Step 4: 运行全量验证**

Run: `npm.cmd run test && npm.cmd run build && git diff --check`

Expected: 全部测试与两个 Vite 构建通过，diff 无空白错误。

- [ ] **Step 5: 提交、推送、部署和生产验收**

```bash
git add packages/mobile-h5/src/views/MallView.vue shared/product-details.js tests/ui-audit.test.js deploy/zsyy.production.conf deploy/provision-zsyy-production.sh
git commit -m "feat: show product detail images"
git push origin main
```

创建时间戳发布包；解压源代码到 `/opt/zsyy/releases/<release>`，将 H5 构建物解压到 `/var/www/zsyy/releases/<release>/mobile`，后台构建物解压到 `/var/www/zsyy/releases/<release>/admin`，切换 `current` 符号链接并重启 `zsyy-api`。使用管理员上传一张测试图片并创建下架测试商品，确认 H5 不显示下架商品、后台可编辑、图片返回正确 MIME 类型后报告结果。
