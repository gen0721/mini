import { create } from 'zustand'
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

export const api = axios.create({ baseURL: `${BASE}/api` })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('mn_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('mn_token')
    useStore.getState().setUser(null)
  }
  return Promise.reject(err)
})

export const useStore = create(set => ({
  user: null,
  setUser: user => set({ user }),
  logout: () => { localStorage.removeItem('mn_token'); set({ user: null }) },

  categories: [],
  setCategories: cats => set({ categories: cats }),

  cart: [],
  addToCart: item => set(s => ({ cart: [...s.cart.filter(i=>i._id!==item._id), item] })),
  removeFromCart: id => set(s => ({ cart: s.cart.filter(i=>i._id!==id) })),
}))
