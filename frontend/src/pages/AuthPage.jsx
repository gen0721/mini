import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api, useStore } from '../store'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [params] = useSearchParams()
  const navigate  = useNavigate()
  const { setUser } = useStore()
  const [mode, setMode] = useState(params.get('mode')==='register' ? 'register' : 'login')
  const [step, setStep] = useState(1) // register: 1=username, 2=verify+password
  const [resetStep, setResetStep] = useState(1) // reset: 1=username, 2=code+new password

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode]         = useState('')
  const [newPass, setNewPass]   = useState('')
  const [botName, setBotName]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async () => {
    if (!username||!password) return toast.error('Заполните все поля')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('mn_token', data.token)
      setUser(data.user)
      toast.success('Добро пожаловать!')
      navigate('/')
    } catch(e) { toast.error(e.response?.data?.error||'Ошибка входа') }
    setLoading(false)
  }

  const handleRegisterCheck = async () => {
    if (username.length < 3) return toast.error('Минимум 3 символа')
    setLoading(true)
    try {
      // Init user stub
      await api.post('/auth/register/init', { username })
      const { data } = await api.post('/auth/register/check', { username })
      setBotName(data.botUsername)
      setStep(2)
      toast.success('Логин свободен! Получите код в боте.')
    } catch(e) { toast.error(e.response?.data?.error||'Ошибка') }
    setLoading(false)
  }

  const handleRegisterVerify = async () => {
    if (!code || !password) return toast.error('Заполните все поля')
    if (password.length < 6) return toast.error('Пароль минимум 6 символов')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register/verify', { username, code, password })
      localStorage.setItem('mn_token', data.token)
      setUser(data.user)
      toast.success('Аккаунт создан!')
      navigate('/')
    } catch(e) { toast.error(e.response?.data?.error||'Ошибка') }
    setLoading(false)
  }

  const handleResetRequest = async () => {
    if (!username) return toast.error('Введите логин')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/reset/request', { username })
      setBotName(data.botUsername)
      setResetStep(2)
      toast.success('Запросите код в боте!')
    } catch(e) { toast.error(e.response?.data?.error||'Ошибка') }
    setLoading(false)
  }

  const handleResetConfirm = async () => {
    if (!code||!newPass) return toast.error('Заполните все поля')
    setLoading(true)
    try {
      await api.post('/auth/reset/confirm', { username, code, newPassword:newPass })
      toast.success('Пароль изменён! Войдите.')
      setMode('login')
      setResetStep(1)
    } catch(e) { toast.error(e.response?.data?.error||'Ошибка') }
    setLoading(false)
  }

  const BotInstructions = ({ action }) => (
    <div style={{
      background:'rgba(245,200,66,0.06)', border:'1px solid rgba(245,200,66,0.2)',
      borderRadius:14, padding:16, marginBottom:20
    }}>
      <div style={{ fontFamily:'var(--font-h)', fontWeight:700, fontSize:13, color:'var(--accent)', marginBottom:10 }}>
        📱 Инструкция
      </div>
      <ol style={{ color:'var(--t2)', fontSize:13, lineHeight:2, paddingLeft:18 }}>
        <li>Откройте бота <a href={`https://t.me/${botName||'MinionsMarketBot'}`} target="_blank" rel="noopener" style={{color:'var(--accent)'}}>{botName ? `@${botName}` : 'Telegram Bot'}</a></li>
        <li>Отправьте команду: <code style={{background:'var(--bg3)',padding:'2px 8px',borderRadius:6,color:'var(--accent)',fontFamily:'monospace'}}>/{action} {username}</code></li>
        <li>Скопируйте полученный код и вставьте ниже</li>
      </ol>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20,
      background:'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(245,200,66,0.08), transparent)' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🟡</div>
          <div style={{ fontFamily:'var(--font-h)', fontWeight:800, fontSize:24 }}>Minions<span style={{color:'var(--accent)'}}>.</span>Market</div>
        </div>

        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:24, padding:32 }}>
          {/* Tabs (login/register only) */}
          {mode !== 'reset' && (
            <div style={{ display:'flex', background:'var(--bg3)', borderRadius:12, padding:4, marginBottom:28 }}>
              {[['login','Войти'],['register','Регистрация']].map(([m,l]) => (
                <button key={m} onClick={()=>{setMode(m);setStep(1);setResetStep(1);setUsername('');setPassword('');setCode('')}} style={{
                  flex:1, padding:'10px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'var(--font-h)',
                  fontWeight:700, fontSize:13, transition:'all 0.2s',
                  background: mode===m ? 'var(--bg)' : 'transparent',
                  color: mode===m ? 'var(--t1)' : 'var(--t3)',
                  boxShadow: mode===m ? '0 2px 8px rgba(0,0,0,0.3)' : 'none'
                }}>{l}</button>
              ))}
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <div className="anim-in">
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ЛОГИН</label>
                <input className="inp" placeholder="your_username" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ПАРОЛЬ</label>
                <div style={{ position:'relative' }}>
                  <input className="inp" type={showPass?'text':'password'} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{paddingRight:44}}/>
                  <button onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--t3)', fontSize:16 }}>{showPass?'🙈':'👁'}</button>
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleLogin} disabled={loading}>
                {loading ? <span style={{width:16,height:16,border:'2px solid transparent',borderTopColor:'currentColor',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : 'Войти →'}
              </button>
              <button onClick={()=>{setMode('reset');setUsername('');setResetStep(1)}} style={{ marginTop:12, background:'none', border:'none', color:'var(--t3)', fontSize:13, cursor:'pointer', width:'100%', textAlign:'center' }}>
                Забыл пароль?
              </button>
            </div>
          )}

          {/* REGISTER step 1 */}
          {mode === 'register' && step === 1 && (
            <div className="anim-in">
              <div style={{ background:'rgba(124,106,255,0.08)', border:'1px solid rgba(124,106,255,0.2)', borderRadius:12, padding:14, marginBottom:20, fontSize:13, color:'var(--t2)', lineHeight:1.6 }}>
                💡 Регистрация через Telegram бот — просто и безопасно. Никакой почты!
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ПРИДУМАЙТЕ ЛОГИН</label>
                <input className="inp" placeholder="только латиница и цифры" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} onKeyDown={e=>e.key==='Enter'&&handleRegisterCheck()}/>
                <div style={{ fontSize:11, color:'var(--t4)', marginTop:6 }}>Минимум 3 символа, только a-z, 0-9, _</div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleRegisterCheck} disabled={loading}>
                {loading ? <span style={{width:16,height:16,border:'2px solid transparent',borderTopColor:'currentColor',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : 'Далее →'}
              </button>
            </div>
          )}

          {/* REGISTER step 2 */}
          {mode === 'register' && step === 2 && (
            <div className="anim-in">
              <button onClick={()=>setStep(1)} style={{ background:'none',border:'none',color:'var(--t3)',fontSize:13,cursor:'pointer',marginBottom:16,padding:0,display:'flex',alignItems:'center',gap:6 }}>← Назад</button>
              <BotInstructions action="code" />
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>КОД ИЗ БОТА</label>
                <input className="inp" placeholder="123456" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} style={{ letterSpacing:'0.3em', fontSize:20, fontFamily:'var(--font-h)', textAlign:'center' }}/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ПРИДУМАЙТЕ ПАРОЛЬ</label>
                <div style={{ position:'relative' }}>
                  <input className="inp" type={showPass?'text':'password'} placeholder="Минимум 6 символов" value={password} onChange={e=>setPassword(e.target.value)} style={{paddingRight:44}}/>
                  <button onClick={()=>setShowPass(!showPass)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--t3)', fontSize:16 }}>{showPass?'🙈':'👁'}</button>
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleRegisterVerify} disabled={loading}>
                {loading ? <span style={{width:16,height:16,border:'2px solid transparent',borderTopColor:'currentColor',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : 'Создать аккаунт →'}
              </button>
            </div>
          )}

          {/* RESET step 1 */}
          {mode === 'reset' && resetStep === 1 && (
            <div className="anim-in">
              <div style={{ fontFamily:'var(--font-h)', fontWeight:800, fontSize:20, marginBottom:20 }}>Сброс пароля</div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>ВАШ ЛОГИН</label>
                <input className="inp" placeholder="your_username" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())}/>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleResetRequest} disabled={loading}>
                {loading ? <span style={{width:16,height:16,border:'2px solid transparent',borderTopColor:'currentColor',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : 'Получить код →'}
              </button>
              <button onClick={()=>setMode('login')} style={{ marginTop:12,background:'none',border:'none',color:'var(--t3)',fontSize:13,cursor:'pointer',width:'100%',textAlign:'center' }}>← Назад к входу</button>
            </div>
          )}

          {/* RESET step 2 */}
          {mode === 'reset' && resetStep === 2 && (
            <div className="anim-in">
              <div style={{ fontFamily:'var(--font-h)', fontWeight:800, fontSize:20, marginBottom:20 }}>Введите новый пароль</div>
              <BotInstructions action="reset" />
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>КОД ИЗ БОТА</label>
                <input className="inp" placeholder="123456" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} style={{ letterSpacing:'0.3em', fontSize:20, fontFamily:'var(--font-h)', textAlign:'center' }}/>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-h)', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>НОВЫЙ ПАРОЛЬ</label>
                <input className="inp" type={showPass?'text':'password'} placeholder="Минимум 6 символов" value={newPass} onChange={e=>setNewPass(e.target.value)}/>
              </div>
              <button className="btn btn-primary btn-full" onClick={handleResetConfirm} disabled={loading}>
                {loading ? <span style={{width:16,height:16,border:'2px solid transparent',borderTopColor:'currentColor',borderRadius:'50%',animation:'spin 0.7s linear infinite',display:'inline-block'}}/> : 'Сохранить пароль →'}
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign:'center', color:'var(--t4)', fontSize:12, marginTop:16, lineHeight:1.6 }}>
          Регистрируясь, вы принимаете{' '}
          <Link to="/legal/rules" style={{ color:'var(--t3)' }}>правила</Link> и{' '}
          <Link to="/legal/privacy" style={{ color:'var(--t3)' }}>политику конфиденциальности</Link>
        </p>
      </div>
    </div>
  )
}
