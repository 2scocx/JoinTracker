import React, {useEffect, useState} from 'react'
import { loadState, saveState, clearState } from '../lib/storage'
import { v4 as uuidv4 } from 'uuid'
import nugImg from '../assets/nug.png'
import hashImg from '../assets/hash.png'
import waxImg from '../assets/wax.png'

export default function Home({translations, lang}){
  const [state, setState] = useState(null)
  const [weight, setWeight] = useState('0.3')
  const [kind, setKind] = useState('nug') // 'nug', 'hash', or 'wax'
  const [note, setNote] = useState('')
  const [pricePerGram, setPricePerGram] = useState('10')
  const [lastInputs, setLastInputs] = useState({ nug: { price: '10', note: '', weight: '0.3' }, hash: { price: '', note: '', weight: '' }, wax: { price: '', note: '', weight: '' } });
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [notifyEnabled, setNotifyEnabled] = useState(false)

  useEffect(()=>{
    (async ()=>{
      const s = await loadState()
      setState(s)
      // restore persisted lastInputs if available
      if(s && s.settings && s.settings.lastInputs){
        setLastInputs(prev => ({ ...prev, ...s.settings.lastInputs }))
      }
      // restore notification enabled flag
      if(s && s.settings && s.settings.notify){
        setNotifyEnabled(true)
      }
    })()
  }, [])

  // helper to persist lastInputs into storage.settings
  async function updateLastInputs(kindKey, { price, note: newNote, weight: newWeight } = {}){
    setLastInputs(prev => {
      const current = prev[kindKey] || {}
      const nextKind = {
        price: typeof price !== 'undefined' ? price : current.price || '',
        note: typeof newNote !== 'undefined' ? newNote : current.note || '',
        weight: typeof newWeight !== 'undefined' ? newWeight : current.weight || ''
      }
      const next = { ...prev, [kindKey]: nextKind }
      ;(async ()=>{
        // persist into saved state.settings.lastInputs
        try{
          const s = await loadState()
          s.settings = s.settings || {}
          s.settings.lastInputs = next
          await saveState(s)
          // also update in-memory state.settings for UI consistency
          setState(prevState => prevState ? { ...prevState, settings: { ...(prevState.settings||{}), lastInputs: next }} : s)
        }catch(e){
          // ignore persistence errors
          console.error('Failed to persist lastInputs', e)
        }
      })()
      return next
    })
  }

  async function addJoint(){
    if(!state) return
    const w = parseFloat(weight)||0.1
    const pricePerG = parseFloat(pricePerGram)||0
    const price = +(w * pricePerG)
    const entry = { id: uuidv4(), createdAt: new Date().toISOString(), weight: w, price, kind, note: note.trim() }
    const s = {...state, entries: [entry, ...state.entries], undoStack: [{action:'add', entry}, ...(state.undoStack||[])] }
    await saveState(s)
    setState(s)
    // persist last inputs for this kind (keep inputs filled for next add)
    updateLastInputs(kind, { price: pricePerGram, note, weight })
  }

  async function saveNoteEdit(id) {
    if (!state) return;
    const entries = state.entries.map(e => e.id === id ? { ...e, note: editingNoteValue } : e);
    const s = { ...state, entries };
    await saveState(s);
    setState(s);
    setEditingNoteId(null);
    setEditingNoteValue('');
  }

  async function undoLast(){
    if(!state || !state.undoStack || state.undoStack.length===0) return
    const top = state.undoStack[0]
    let s = {...state}
    s.undoStack = s.undoStack.slice(1)
    if(top.action==='add'){
      s.entries = s.entries.filter(e=>e.id !== top.entry.id)
    }
    await saveState(s)
    setState(s)
  }

  async function undoEntry(id){
    if(!state) return
    const entry = state.entries.find(e=>e.id===id)
    if(!entry) return
    const s = {...state, entries: state.entries.filter(e=>e.id!==id), undoStack: [{action:'delete', entry}, ...(state.undoStack||[])] }
    await saveState(s)
    setState(s)
  }

  async function restoreUndo(){
    if(!state || !state.undoStack || state.undoStack.length===0) return
    const top = state.undoStack[0]
    let s = {...state}
    s.undoStack = s.undoStack.slice(1)
    if(top.action==='delete'){
      s.entries = [top.entry, ...s.entries]
    }
    await saveState(s)
    setState(s)
  }

  async function toggleNotifications(){
    const s = await loadState()
    s.settings = s.settings || {}
    // If notifications already enabled, disable them (UI only; browser permissions cannot be revoked programmatically)
    if(s.settings.notify){
      s.settings.notify = false
      await saveState(s)
      setState(s)
      setNotifyEnabled(false)
      return
    }
    // otherwise request permission and enable
    if(Notification && Notification.permission !== 'granted'){
      await Notification.requestPermission()
    }
    s.settings.notify = true
    await saveState(s)
    setState(s)
    setNotifyEnabled(true)
  }

  // When kind changes, restore last used price and note for that kind
  useEffect(() => {
    setPricePerGram(lastInputs[kind]?.price || '')
    setNote(lastInputs[kind]?.note || '')
    setWeight(lastInputs[kind]?.weight || '')
  }, [kind])

  if(!state) return <div className="p-4">Loading...</div>

  const totalMoney = state.entries.reduce((s,e)=> s + (e.price||0), 0)
  const totalGrams = state.entries.reduce((s,e)=> s + (e.weight||0), 0)
  const totalJoints = state.entries.length

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div className="card">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold">{translations.addJoint}</h2><p className="text-sm text-gray-500">Inputs labeled</p></div>
          <div className="text-xs text-gray-400">Started {new Date(state.startedAt).toLocaleDateString()}</div>
        </div>
        <div className="mt-3 space-y-2">
          <label className="block text-sm font-medium">{translations.weight}</label>
          <input type="number" value={weight} onChange={e=>{ setWeight(e.target.value); updateLastInputs(kind, { weight: e.target.value }) }} className="w-full border p-2 rounded" />

          <label className="block text-sm font-medium">{translations.pricePerGram} ({state.settings.currency})</label>
          <input type="number" value={pricePerGram} onChange={e=>{
            setPricePerGram(e.target.value);
            updateLastInputs(kind, { price: e.target.value })
          }} className="w-full border p-2 rounded" />

          <label className="block text-sm font-medium">{translations.kind}</label>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2">
              <input type="radio" checked={kind==='nug'} onChange={()=>setKind('nug')} />
              <img src={nugImg} alt="nug" className="w-8 h-8"/>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" checked={kind==='hash'} onChange={()=>setKind('hash')} />
              <img src={hashImg} alt="hash" className="w-8 h-8"/>
            </label>
            <label className="flex items-center space-x-2">
              <input type="radio" checked={kind==='wax'} onChange={()=>setKind('wax')} />
              <img src={waxImg} alt="wax" className="w-8 h-8"/>
            </label>
          </div>

          <label className="block text-sm font-medium mt-2">Note (strain, details, etc)</label>
          <input type="text" value={note} onChange={e=>{
            setNote(e.target.value);
            updateLastInputs(kind, { note: e.target.value })
          }} className="w-full border p-2 rounded" placeholder="e.g. Blue Dream, 22% THC..." />
          <div className="flex space-x-2 mt-3">
            <button onClick={addJoint} className="flex-1 px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400">{translations.add}</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold">{translations.summary}</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-sm text-gray-500">{translations.money}</div><div className="font-medium">{state.settings.currency}{totalMoney.toFixed(2)}</div></div>
          <div><div className="text-sm text-gray-500">{translations.grams}</div><div className="font-medium">{totalGrams.toFixed(2)} g</div></div>
          <div><div className="text-sm text-gray-500">{translations.joints}</div><div className="font-medium">{totalJoints}</div></div>
        </div>
        <div className="mt-2">
          <div className="flex space-x-2">
            <button onClick={undoLast} className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400">Undo last</button>
            <button onClick={restoreUndo} className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400">Restore</button>
            <button onClick={toggleNotifications} className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400">{ (notifyEnabled || (state.settings && state.settings.notify)) ? translations.notifyDisable : translations.notifyEnable }</button>
          </div>
          { (notifyEnabled || (state.settings && state.settings.notify)) && (
            <div className="notify-info-box mt-3">
              {translations.notifyInfo}
            </div>
          ) }
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold">Recent</h3>
        <div className="mt-2 space-y-2">
          {state.entries.slice(0,20).map(e=> (
            <div key={e.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img src={
                    e.kind==='nug' ? nugImg :
                    e.kind==='hash' ? hashImg :
                    e.kind==='wax' ? waxImg : ''
                  } alt={e.kind} className="w-8 h-8"/>
                  <div>
                    <div className="text-sm">{new Date(e.createdAt).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{e.weight} g</div>
                  </div>
                </div>
                <div className="text-sm flex items-center space-x-2"><div>{state.settings.currency}{(e.price||0).toFixed(2)}</div><button onClick={()=>undoEntry(e.id)} className="px-2 py-1 bg-red-100 rounded text-xs">Undo</button></div>
              </div>
              <div className="ml-12">
                {editingNoteId === e.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={editingNoteValue}
                      onChange={ev => setEditingNoteValue(ev.target.value)}
                      className="border p-1 rounded flex-1"
                      placeholder="Edit note..."
                    />
                    <button onClick={()=>saveNoteEdit(e.id)} className="px-2 py-1 bg-teal-500 text-white rounded text-xs">Save</button>
                    <button onClick={()=>{setEditingNoteId(null);setEditingNoteValue('')}} className="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{e.note || <span className="italic text-gray-300">No note</span>}</span>
                    <button onClick={()=>{setEditingNoteId(e.id);setEditingNoteValue(e.note||'')}} className="px-2 py-1 bg-gray-100 rounded text-xs">Edit</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {state.entries.length===0 && <div className="text-sm text-gray-400">No data yet — add some joints.</div>}
        </div>
      </div>
    </div>
  )
}
