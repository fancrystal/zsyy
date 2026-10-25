import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import MallView from './views/MallView.vue'
import OrdersView from './views/OrdersView.vue'
import ProfileView from './views/ProfileView.vue'
import AuthView from './views/AuthView.vue'
import { state, isDemo, refreshSession } from '../../shared/store.js'
import './style.css'
const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/', component: HomeView }, { path: '/mall', component: MallView },
  { path: '/orders', component: OrdersView }, { path: '/me', component: ProfileView },
  { path: '/login', component: AuthView },
  { path: '/:pathMatch(.*)*', redirect: '/' }
], scrollBehavior: () => ({ top: 0 }) })
router.beforeEach(async to=>{if(!isDemo&&['/orders','/me'].includes(to.path)){try{await refreshSession()}catch{return {path:'/login',query:{returnTo:to.fullPath}}}if(!state.value.profile)return {path:'/login',query:{returnTo:to.fullPath}}}})
createApp(App).use(router).mount('#app')
