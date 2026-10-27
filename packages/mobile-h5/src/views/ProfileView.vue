<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { state, rebate, largestMarketId, saveAddress, isDemo, loadLedger, income, loadIncome, refreshSession, saveProfile, signOut } from '../../../shared/store.js'
import { money } from '../../../shared/demo.mjs'
import { incomeText, incomeTitle } from '../../../shared/income.js'
import Icon from '../../../shared/Icon.vue'
import Modal from '../components/Modal.vue'
const incomeBusy=ref(false)
async function moreIncome(category){if(incomeBusy.value)return;incomeBusy.value=true;error.value='';try{await loadIncome(category)}catch(e){error.value=e.message}finally{incomeBusy.value=false}}
const panel = ref(''), error = ref(''), message = ref(''), address = reactive({ recipient: '', phone: '', detail: '' })
const titles = { address: '默认收货地址', team: '我的团队', ledger: '产品券明细', rebate: '收益记录', invite: '邀请好友' }
titles.profile='个人资料'
const router=useRouter(),nickname=ref(''),busy=ref(false)
const inviteLink=()=>`${window.location.origin}${window.location.pathname}#/login?invite=${encodeURIComponent(state.value.profile.inviteCode)}`
async function refresh(){if(isDemo)return;try{await Promise.all([refreshSession(),loadLedger(),loadIncome()])}catch(e){error.value=e.message}}
onMounted(refresh)
async function open(name) { error.value = ''; message.value = ''; if (name === 'address') Object.assign(address, state.value.address || { recipient: '', phone: '', detail: '' });if(name==='profile')nickname.value=state.value.profile.nickname; panel.value = name;if(!isDemo){try{if(name==='ledger')await loadLedger();if(name==='rebate')await loadIncome();if(name==='team')await refreshSession()}catch(e){error.value=e.message}} }
async function save() { if(busy.value)return;busy.value=true;try { await saveAddress({ ...address }); panel.value = ''; message.value = '默认收货地址已保存' } catch (e) { error.value = e.message }finally{busy.value=false} }
async function editProfile(){busy.value=true;try{await saveProfile(nickname.value);panel.value='';message.value='个人资料已保存'}catch(e){error.value=e.message}finally{busy.value=false}}
async function logout(){try{await signOut();router.replace('/login')}catch(e){error.value=e.message}}
async function more(){try{await loadLedger(state.value.ledgerPage.page+1)}catch(e){error.value=e.message}}
async function copyLink(){try{await navigator.clipboard.writeText(inviteLink());message.value='邀请链接已复制'}catch{error.value='无法复制，请长按下方邀请链接手动复制'}}
async function copy() { try { await navigator.clipboard.writeText(state.value.profile.inviteCode); message.value = '邀请码已复制' } catch { error.value = '暂时无法复制，请长按邀请码手动复制' } }
</script>
<template>
  <section v-if="!state.profile" class="empty-state"><h1>登录后管理我的账户</h1><RouterLink class="primary" to="/login">登录 / 注册</RouterLink></section>
  <template v-else>
  <div class="profile-header"><span class="avatar">{{ state.profile.nickname.slice(0,1) }}</span><div><h1>{{ state.profile.nickname }}<span class="member-tag">普通用户</span></h1><p>ID {{ state.profile.id }}<span>邀请码 {{ state.profile.inviteCode }}</span></p></div></div>
  <section class="wallet-card"><div class="wallet-heading"><span><Icon name="ticket" :size="18" />我的产品券</span><button @click="open('ledger')">收支明细 <Icon name="arrow" :size="14" /></button></div><div class="wallet-amount">{{ money(state.balanceUnits) }}<small>券</small></div><p>可用于商城商品购买</p><div class="wallet-bottom"><span>累计总收益 <strong>{{ money(income.summary.totalUnits) }}</strong> 券</span><Icon name="shield" :size="17" /></div></section>
  <div class="section-title profile-section-title"><h2>我的团队</h2><button class="text-button" @click="open('team')">查看团队 <Icon name="arrow" :size="15" /></button></div>
  <button class="team-summary" @click="open('team')"><div><strong>{{ state.markets.length }}</strong><span>直属下线</span></div><div><strong>{{ state.markets.reduce((n, m) => n + m.members, 0) }}</strong><span>团队人数</span></div><div><strong>{{ money(rebate.total) }}</strong><span>团队累计消费 / 券</span></div></button>
  <p v-if="message && !panel" class="success-note" role="status">{{ message }}</p>
  <div class="menu-group"><button @click="open('address')"><span class="menu-icon blue"><Icon name="pin" :size="20" /></span><span><strong>默认收货地址</strong><small>{{ state.address ? `${state.address.recipient} · ${state.address.detail}` : '填写线下发货的收货信息' }}</small></span><Icon name="arrow" :size="17" /></button><button @click="open('invite')"><span class="menu-icon gold"><Icon name="team" :size="20" /></span><span><strong>邀请好友</strong><small>分享邀请码，加入我的团队</small></span><Icon name="arrow" :size="17" /></button><button @click="open('rebate')"><span class="menu-icon green"><Icon name="chart" :size="20" /></span><span><strong>收益记录</strong><small>每一笔产品券收益，都有记录</small></span><Icon name="arrow" :size="17" /></button><RouterLink to="/orders"><span class="menu-icon blue"><Icon name="orders" :size="20" /></span><span><strong>我的订单</strong><small>查看全部购买记录</small></span><Icon name="arrow" :size="17" /></RouterLink></div>
  <div class="rule-note"><Icon name="shield" :size="18" /><p>产品券由后台发放，仅用于商城购买。<br>收益以产品券发放，不涉及现金交易。</p></div>
  <div v-if="!isDemo" class="account-actions"><button class="secondary" @click="open('profile')">编辑个人资料</button><button class="secondary" @click="refresh">刷新账户</button><button class="secondary" @click="logout">退出登录</button></div>
  <p v-if="error && !panel" class="error" role="alert">{{ error }}</p>
  <Modal v-if="panel" :title="titles[panel]" @close="panel = ''">
    <form v-if="panel === 'profile'" class="form-stack" @submit.prevent="editProfile"><label>昵称<input v-model.trim="nickname" required maxlength="60"></label><p class="muted">用户名和上下线关系不可在此更改。</p><button type="submit" class="primary" :disabled="busy">保存资料</button></form>
    <p v-if="error && !['address','invite'].includes(panel)" class="error" role="alert">{{ error }}</p>
    <div v-if="!isDemo && panel === 'invite'" class="live-invite"><label>我的注册邀请链接<input readonly :value="inviteLink()" aria-label="邀请链接"></label><button class="secondary full" @click="copyLink">复制邀请链接</button></div>
    <button v-if="!isDemo && panel === 'ledger' && state.ledger.length < state.ledgerPage.total" class="text-button" @click="more('ledger')">加载更多流水</button>
    <form v-if="panel === 'address'" class="form-stack" @submit.prevent="save"><label>收件人<input v-model="address.recipient" autocomplete="name" maxlength="40" required placeholder="请输入收件人姓名"></label><label>手机号<input v-model="address.phone" autocomplete="tel" inputmode="tel" type="tel" maxlength="11" required placeholder="请输入 11 位手机号"></label><label>完整收货地址<textarea v-model="address.detail" autocomplete="street-address" rows="3" maxlength="200" required placeholder="省 / 市 / 区 / 街道及门牌号"></textarea></label><p class="muted">修改只影响之后的订单，已购买订单保留原收货信息。</p><p v-if="error" class="error" role="alert">{{ error }}</p><button class="primary full" type="submit">保存默认地址</button></form>
    <template v-if="panel === 'team'"><div class="stat-highlight"><span>团队累计消费</span><strong>{{ money(rebate.total) }}<small>券</small></strong></div><div v-for="market in state.markets" :key="market.id" class="market-row"><span class="mini-avatar">{{ market.name.slice(0, 1) }}</span><div><strong>{{ market.name }} <small v-if="market.id === largestMarketId" class="market-tag">最大市场</small></strong><p>ID {{ market.id }} · 团队 {{ market.members }} 人</p></div><b>{{ money(market.units) }}<small>券</small></b></div><div class="rule-box"><h3>收益规则</h3><h4>推荐收益（直接推荐 20%）</h4><p>直属推荐用户完成订单后，推荐人获得该订单金额的 20%；仅限直接推荐关系。</p><h4>团队佣金（团队收益 10%）</h4><p>排除累计消费最高的一个子市场，其余子市场累计消费的 10% 计入收益，扣除已发收益后补发差额。</p><p>本人的消费计入上级市场，不计入本人的团队。</p></div></template>
    <template v-if="panel === 'ledger'"><div class="stat-highlight"><span>当前产品券余额</span><strong>{{ money(state.balanceUnits) }}<small>券</small></strong></div><div v-for="item in state.ledger" :key="item.id" class="ledger-row"><span class="menu-icon" :class="item.amountUnits > 0 ? 'green' : 'blue'"><Icon :name="item.type === 'order' ? 'bag' : 'ticket'" :size="20" /></span><div><strong>{{ incomeTitle(item) }}</strong><p>{{ incomeText(item.note) }}</p><small>{{ item.createdAt }}</small></div><b :class="{ 'success-text': item.amountUnits > 0 }">{{ item.amountUnits > 0 ? '+' : '−' }}{{ money(Math.abs(item.amountUnits)) }}</b></div></template>
    <template v-if="panel === 'rebate'">
      <div class="stat-highlight"><span>累计总收益</span><strong>{{ money(income.summary.totalUnits) }}<small>券</small></strong></div>
      <section v-for="category in [{key:'referral',title:'推荐收益（直接推荐20%）',label:'推荐收益记录',amount:income.summary.referralUnits},{key:'team',title:'团队佣金（团队收益10%）',label:'团队佣金记录',amount:income.summary.teamUnits}]" :key="category.key" class="income-section" :aria-label="category.label">
        <div class="income-heading"><h3>{{ category.title }}</h3><strong>{{ money(category.amount) }} 券</strong></div>
        <div v-for="item in income[category.key].items" :key="item.id" class="ledger-row"><span class="menu-icon green"><Icon name="chart" /></span><div><strong>{{ category.key==='referral'?'推荐收益到账':'团队佣金到账' }}</strong><p>{{ item.createdAt }}</p></div><b class="success-text">+{{ money(item.amountUnits) }}</b></div>
        <p v-if="!income[category.key].items.length" class="muted">暂无收益记录</p>
        <button v-if="!isDemo && income[category.key].items.length < income[category.key].total" class="text-button" :disabled="incomeBusy" @click="moreIncome(category.key)">加载更多{{ category.key==='referral'?'推荐收益':'团队佣金' }}</button>
      </section>
      <p class="subtle-note">团队佣金按排除最大市场后的累计消费计算，仅统计已到账收益。</p>
    </template>
    <template v-if="panel === 'invite'"><div class="invite-card"><span class="eyebrow">一起发现美好生活</span><h3>邀请好友，加入团队</h3><p>注册时填写我的邀请码</p><strong class="invite-code">{{ state.profile.inviteCode }}</strong><button class="primary full" @click="copy"><Icon name="copy" :size="17" />复制邀请码</button><p>每人仅绑定一个上线，绑定后不更换。</p></div><p v-if="message" class="success-note" role="status">{{ message }}</p><p v-if="error" class="error" role="alert">{{ error }}</p><p class="subtle-note">此为界面预览，注册及邀请链接将在账号功能接入后提供。</p></template>
  </Modal>
  </template>
</template>
