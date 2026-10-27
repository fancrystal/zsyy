export const incomeText = value => String(value ?? '').replaceAll('返利', '收益')
export const incomeTitle = item => ['team_rebate', 'rebate'].includes(item.type) ? '团队佣金' : item.type === 'direct_referral_reward' ? '推荐收益' : incomeText(item.title)
