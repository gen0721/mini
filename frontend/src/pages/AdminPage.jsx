import React, { useState, useEffect } from 'react'
import { api } from '../store'
import toast from 'react-hot-toast'

const adminApi = {
  get: (path) => {
    const token = localStorage.getItem('mn_admin_token')
    return fetch('/api/admin'+path, { headers:{ 'x-admin-token':token||'' } }).then(r=>r.json())
  },
  post: (path, body) => {
    const token = localStorage.getItem('mn_admin_token')
    return fetch('/api/admin'+path, { method:'POST', headers:{ 'Content-Type':'application/json', 'x-admin-token':token||'' }, body:JSON.stringify(body) }).then(r=>r.json())
  },
  del: (path) => {
    const token = localStorage.getItem('mn_admin_token')
    return fetch('/api/admin'+path, { method:'DELETE', headers:{ 'x-admin-token':token||'' } }).then(r=>r.json())
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('mn_admin_token'))
  const [login, setLogin]   = useState('')
  const [pass, setPass]     = useState('')
  const [tab, setTab]       = useState('stats')
  const [stats, setStats]   = useState(null)
  const [users, setUsers]   = useState([])
  const [deals, setDeals]   = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [msgUserId, setMsgUserId]   = useState('')
  const [msgText, setMsgText]       = useState('')

  const handleLogin = async () => {
    setLoading(true)
    const res = await adminApi.post('/login', { login, password: pass })
    setLoading(false)
    if (res.token) {
      localStorage.setItem('mn_admin_token', res.token)
      setAuthed(true)
      toast.success('Добро пожаловать, Администратор!')
    } else {
      toast.error(res.error||'Неверные данные')
    }
  }

  const loadTab = async (t) => {
    setLoading(true)
    if (t==='stats') {
      const res = await adminApi.get('/stats')
      setStats(res)
    } else if (t==='users') {
      const res = await adminApi.get(`/users?search=${userSearch}`)
      setUsers(res.users||[])
    } else if (t==='deals') {
      const res = await adminApi.get('/deals')
      setDeals(res.deals||[])
    } else if (t==='products') {
      const res = await adminApi.get('/products')
      setProducts(res.products||[])
    }
    setLoading(false)
  }

  useEffect(() => { if (authed) loadTab(tab) }, [authed, tab])

  const banUser = async (id) => {
    const hours = window.prompt('Часов блокировки (пусто = навсегда):')
    const reason = window.prompt('Причина:') || ''
    const res = await adminApi.post(`/users/${id}/ban`, { hours: hours?parseInt(hours):null, reason })
    if (res.ok) { toast.success('Заблокирован'); loadTab('users') }
    else toast.error(res.error)
  }

  const unbanUser = async (id) => {
    const res = await adminApi.post(`/users/${id}/unban`, {})
    if (res.ok) { toast.success('Разблокирован'); loadTab('users') }
    else toast.error(res.error)
  }

  const adjustBalance = async (id) => {
    const amount = window.prompt('Сумма (+/-):', '0')
    const reason = window.prompt('Причина:') || 'Admin'
    if (!amount) return
    const res = await adminApi.post(`/users/${id}/balance`, { amount:parseFloat(amount), reason })
    if (res.ok) { toast.success(`Баланс изменён. Новый: $${res.newBalance}`); loadTab('users') }
    else toast.error(res.error)
  }

  const sendMessage = async () => {
    if (!msgUserId||!msgText) return toast.error('Заполните поля')
    const res = await adminApi.post('/message', { userId:msgUserId, text:msgText })
    if (res.ok) { toast.success('Сообщение отправлено!'); setMsgText(''); setMsgUserId('') }
    else toast.error(res.error)
  }

  const deleteProduct = async (id) => {
    if (!window.confirm('Удалить товар?')) return
    const res = await adminApi.del(`/products/${id}`)
    if (res.ok) { toast.success('Удалён'); loadTab('products') }
    else toast.error(res.error)
  }

  if (!authed) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:24, padding:32, width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>⚡</div>
          <div style={{ fontFamily:'var(--font-h)', fontWeight:800, fontSize:22 }}>Панель администратора</div>
        </div>
        <div style={{ marginBottom:12 }}>
          <input className="inp" placeholder="Логин" value={login} onChange={e=>setLogin(e.target.value)} style={{ marginBottom:10 }}/>
          <input className="inp" type="password" placeholder="Пароль" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
        </div>
        <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loading}>
          {loading?'...':'Войти'}
        </button>
      </div>
    </div>
  )

  const TABS = [['stats','📊 Статистика'],['users','👥 Пользователи'],['deals','🤝 Сделки'],['products','📦 Товары'],['messages','💬 Сообщения']]

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', padding:'24px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontFamily:'var(--font-h)', fontWeight:800, fontSize:24 }}>⚡ Панель администратора</h1>
        <button className="btn btn-danger btn-sm" onClick={()=>{localStorage.removeItem('mn_admin_token');setAuthed(false)}}>Выйти</button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{
            padding:'8px 16px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'var(--font-h)', transition:'all 0.15s',
            background: tab===v ? 'rgba(245,200,66,0.12)' : 'transparent',
            borderColor: tab===v ? 'rgba(245,200,66,0.4)' : 'var(--border)',
            color: tab===v ? 'var(--accent)' : 'var(--t2)'
          }}>{l}</button>
        ))}
      </div>

      {loading && <div style={{textAlign:'center',padding:40,color:'var(--t3)'}}>Загрузка...</div>}

      {/* STATS */}
      {tab==='stats' && stats && !loading && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
            {[['Пользователей',stats.users,'👥'],['Активных товаров',stats.products,'📦'],['Всего сделок',stats.deals,'🤝'],['Доход (комиссии)','$'+(stats.revenue||0).toFixed(2),'💰']].map(([l,v,i])=>(
              <div key={l} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, padding:20, textAlign:'center' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{i}</div>
                <div style={{ fontFamily:'var(--font-h)', fontWeight:800, fontSize:24, color:'var(--accent)' }}>{v}</div>
                <div style={{ color:'var(--t3)', fontSize:12, marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
          <h2 style={{ fontFamily:'var(--font-h)', fontWeight:700, fontSize:18, marginBottom:14 }}>Последние сделки</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {stats.recentDeals?.map(d=>(
              <div key={d._id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 16px', display:'flex', gap:16, alignItems:'center' }}>
                <div style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.product?.title}</div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>@{d.buyer?.username} → @{d.seller?.username}</div>
                <div style={{ fontFamily:'var(--font-h)', fontWeight:700, color:'var(--accent)', fontSize:14 }}>${d.amount}</div>
                <span style={{ fontSize:11, fontWeight:700, color: d.status==='completed'?'var(--green)':d.status==='disputed'?'var(--red)':'var(--accent)' }}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USERS */}
      {tab==='users' && !loading && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <input className="inp" placeholder="Поиск по логину..." value={userSearch} onChange={e=>setUserSearch(e.target.value)} style={{ flex:1 }}/>
            <button className="btn btn-secondary" onClick={()=>loadTab('users')}>Найти</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {users.map(u=>(
              <div key={u._id} style={{ background:'var(--bg2)', border:`1px solid ${u.isBanned?'rgba(231,76,60,0.3)':'var(--border)'}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>@{u.username||'—'} {u.isAdmin&&<span style={{color:'var(--accent)'}}>⚡Admin</span>} {u.isBanned&&<span style={{color:'var(--red)'}}>🚫Бан</span>}</div>
                  <div style={{ fontSize:12, color:'var(--t3)' }}>Баланс: ${parseFloat(u.balance||0).toFixed(2)} · Сделок: {(u.totalSales||0)+(u.totalPurchases||0)}</div>
                  {u.telegramId && <div style={{ fontSize:11, color:'var(--t4)' }}>TG: {u.telegramId}</div>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-sm btn-secondary" onClick={()=>adjustBalance(u._id)}>💰</button>
                  {u.isBanned
                    ? <button className="btn btn-sm btn-secondary" onClick={()=>unbanUser(u._id)}>✅</button>
                    : <button className="btn btn-sm btn-danger" onClick={()=>banUser(u._id)}>🚫</button>
                  }
                  <button className="btn btn-sm btn-ghost" onClick={()=>{setMsgUserId(u._id);setTab('messages')}}>💬</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEALS */}
      {tab==='deals' && !loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {deals.map(d=>(
            <div key={d._id} style={{ background:'var(--bg2)', border:`1px solid ${d.status==='disputed'?'rgba(231,76,60,0.3)':'var(--border)'}`, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{d.product?.title}</div>
                  <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>@{d.buyer?.username} → @{d.seller?.username}</div>
                </div>
                <div style={{ fontFamily:'var(--font-h)', fontWeight:700, color:'var(--accent)' }}>${d.amount}</div>
                <span style={{ fontSize:11, fontWeight:700, color: d.status==='completed'?'var(--green)':d.status==='disputed'?'var(--red)':'var(--accent)' }}>{d.status}</span>
              </div>
              {d.status==='disputed' && (
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button className="btn btn-sm btn-primary" onClick={async()=>{
                    const note = window.prompt('Примечание:')
                    const res = await adminApi.post(`/deals/${d._id}/resolve`, { decision:'complete', note })
                    res.ok ? (toast.success('Завершено в пользу продавца'), loadTab('deals')) : toast.error(res.error)
                  }}>✅ Продавцу</button>
                  <button className="btn btn-sm btn-danger" onClick={async()=>{
                    const note = window.prompt('Примечание:')
                    const res = await adminApi.post(`/deals/${d._id}/resolve`, { decision:'refund', note })
                    res.ok ? (toast.success('Возврат покупателю'), loadTab('deals')) : toast.error(res.error)
                  }}>↩ Покупателю</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PRODUCTS */}
      {tab==='products' && !loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {products.map(p=>(
            <div key={p._id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{p.title}</div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>@{p.seller?.username} · ${p.price} · {p.category}</div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, color: p.status==='active'?'var(--green)':'var(--t3)' }}>{p.status}</span>
              <button className="btn btn-sm btn-danger" onClick={()=>deleteProduct(p._id)}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* MESSAGES */}
      {tab==='messages' && (
        <div style={{ maxWidth:500 }}>
          <h2 style={{ fontFamily:'var(--font-h)', fontWeight:700, fontSize:18, marginBottom:16 }}>Отправить сообщение</h2>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:16, padding:24 }}>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ID ПОЛЬЗОВАТЕЛЯ</label>
              <input className="inp" placeholder="MongoDB ID пользователя" value={msgUserId} onChange={e=>setMsgUserId(e.target.value)}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ТЕКСТ СООБЩЕНИЯ</label>
              <textarea className="inp" rows={4} placeholder="Текст сообщения в Telegram..." value={msgText} onChange={e=>setMsgText(e.target.value)} style={{ resize:'vertical' }}/>
            </div>
            <button className="btn btn-primary btn-full" onClick={sendMessage}>📤 Отправить в Telegram</button>
          </div>
        </div>
      )}
    </div>
  )
}
