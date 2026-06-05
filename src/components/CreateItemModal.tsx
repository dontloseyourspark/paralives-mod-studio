import { useState, useEffect, useRef } from 'react'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'
import { X } from 'phosphor-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  item?: Item | null
}

export default function CreateItemModal({ isOpen, onClose, item }: Props) {
  const addItemWith = useModStore((s) => s.addItemWith)
  const updateItem = useModStore((s) => s.updateItem)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (item) {
      setName(item.name || '')
      setDescription(item.description || '')
      setPrice(item.price || 0)
    } else {
      setName('')
      setDescription('')
      setPrice(0)
    }
    if (isOpen) {
      setTimeout(() => {
        nameRef.current?.focus()
      }, 60)
    }
  }, [item, isOpen])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!isOpen) return null

  const handleSave = () => {
    if (!name.trim()) {
      setToast({ message: 'Item name is required.', type: 'error' })
      return
    }

    if (price < 0) {
      setToast({ message: 'Price cannot be negative.', type: 'error' })
      return
    }

    if (item) {
      updateItem(item.id, { name: name.trim(), description, price })
    } else {
      addItemWith({ name: name.trim(), description, price })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150">
      
      {/* Modal Dialog Card */}
      <div className="w-full max-w-[500px] bg-[#11131e] border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 relative animate-in scale-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-white m-0">
            {item ? 'Edit Item' : 'Create New Item'}
          </h3>
          <button 
            className="bg-transparent border-none text-gray-400 hover:text-white cursor-pointer p-1 rounded-lg flex items-center justify-center transition-colors focus:outline-none" 
            onClick={onClose} 
            aria-label="Close"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        
        <p className="text-xs text-gray-500 font-medium -mt-2 m-0">
          {item ? 'Edit item details.' : 'Add a new item to your mod project.'}
        </p>

        {/* Form Body Fields */}
        <div className="flex flex-col gap-4 my-2">
          {/* Item Name */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Item Name <span className="text-[#8b5cf6] ml-0.5">*</span>
            </label>
            <input 
              ref={nameRef} 
              type="text"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Enter item name" 
              className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/5 transition-all duration-150"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Description
            </label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Describe the item..." 
              className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/5 transition-all duration-150 min-h-[90px] resize-vertical leading-relaxed"
            />
          </div>

          {/* Price */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Price ($) <span className="text-[#8b5cf6] ml-0.5">*</span>
            </label>
            <input 
              type="number" 
              value={String(price)} 
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} 
              min="0"
              step="any"
              className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/5 transition-all duration-150"
            />
          </div>
        </div>

        {/* Modal Inline Toast Notification */}
        {toast && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <div className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl border text-xs font-medium ${
              toast.type === 'error' 
                ? 'bg-rose-950/80 border-rose-500/30 text-rose-200' 
                : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
            }`}>
              <div>{toast.message}</div>
              <button 
                className="bg-transparent border-none text-current opacity-60 hover:opacity-100 cursor-pointer p-0.5 flex items-center justify-center transition-opacity focus:outline-none" 
                onClick={() => setToast(null)}
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="flex justify-end items-center gap-3 border-t border-white/5 pt-4 mt-2">
          <button 
            className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/4 rounded-xl transition-all duration-150 border border-transparent cursor-pointer outline-none focus:outline-none" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 text-sm font-semibold text-white bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] rounded-xl transition-all duration-150 border-none cursor-pointer outline-none focus:outline-none shadow-sm" 
            onClick={handleSave}
          >
            {item ? 'Save' : 'Create Item'}
          </button>
        </div>

      </div>
    </div>
  )
}