import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'

const Home     = lazy(() => import('./pages/HomePage'))
const Auth     = lazy(() => import('./pages/AuthPage'))
const Catalog  = lazy(() => import('./pages/CatalogPage'))
const Product  = lazy(() => import('./pages/ProductPage'))
const Wallet   = lazy(() => import('./pages/WalletPage'))
const Deals    = lazy(() => import('./pages/DealsPage'))
const Sell     = lazy(() => import('./pages/SellPage'))
const Legal    = lazy(() => import('./pages/LegalPage'))
const Admin    = lazy(() => import('./pages/AdminPage'))

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'40vh' }}>
      <div style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background:'var(--bg2)', color:'var(--t1)', border:'1px solid var(--border)' },
        success: { iconTheme:{ primary:'var(--accent)', secondary:'var(--bg)' } }
      }}/>
      <Suspense fallback={<Loader/>}>
        <Routes>
          <Route path="/admin" element={<Admin/>}/>
          <Route path="/auth" element={<Auth/>}/>
          <Route element={<Layout><Suspense fallback={<Loader/>}><Routes>
            <Route path="/" element={<Home/>}/>
            <Route path="/catalog" element={<Catalog/>}/>
            <Route path="/product/:id" element={<Product/>}/>
            <Route path="/wallet" element={<Wallet/>}/>
            <Route path="/deals" element={<Deals/>}/>
            <Route path="/sell" element={<Sell/>}/>
            <Route path="/legal/:page" element={<Legal/>}/>
            <Route path="/contacts" element={<Navigate to="/legal/contacts"/>}/>
            <Route path="*" element={<div style={{textAlign:'center',padding:'80px 20px'}}><div style={{fontSize:48,marginBottom:16}}>🔍</div><div style={{fontFamily:'var(--font-h)',fontWeight:800,fontSize:32}}>404</div></div>}/>
          </Routes></Suspense></Layout>} path="/*"/>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
