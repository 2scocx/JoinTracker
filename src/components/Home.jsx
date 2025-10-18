import React, {useEffect, useState, useRef} from 'react'
import { loadState, saveState, clearState } from '../lib/storage'
import { v4 as uuidv4 } from 'uuid'
import nugImg from '../assets/nug.png'
import hashImg from '../assets/hash.png'
import waxImg from '../assets/wax.png'
import EmojiEffect from './EmojiEffect'
import QuickDataImport from './QuickDataImport'
import { fitPoissonGamma, predictiveMean } from '../lib/stats';
import './SparkleEffect.css';

export default function Home({translations, lang}){
  const [state, setState] = useState(null)
  const [weight, setWeight] = useState('');
  const [kind, setKind] = useState('nug');
  const [note, setNote] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [lastInputs, setLastInputs] = useState({ nug: { price: '10', note: '', weight: '0.3' }, hash: { price: '', note: '', weight: '' }, wax: { price: '', note: '', weight: '' } });
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [emojiEffect, setEmojiEffect] = useState({ show: false, x: 0, y: 0 })
  const addButtonRef = useRef(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteSwitches, setDeleteSwitches] = useState([false,false,false,false,false])

  const [ratingLooks, setRatingLooks] = useState(0);
  const [ratingSmell, setRatingSmell] = useState(0);
  const [ratingTouch, setRatingTouch] = useState(0);
  const [ratingTaste, setRatingTaste] = useState(0);

  const [pendingPotencyId, setPendingPotencyId] = useState(null);
  const [pendingPotencyValue, setPendingPotencyValue] = useState(0);

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
    // Build ratings object
    const ratings = {
      looks: ratingLooks,
      smell: ratingSmell,
      touch: ratingTouch,
      taste: ratingTaste,
      // potency will be added later if needed
    }
    // Determine if this should be pending
    const hasAnyRating = [ratingLooks, ratingSmell, ratingTouch, ratingTaste].some(r => r > 0)
    const pendingPotency = hasAnyRating
    const entry = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      weight: w,
      price,
      kind,
      note: note.trim(),
      ratings: hasAnyRating ? ratings : undefined,
      pendingPotency: pendingPotency ? true : undefined
    }
    const s = {...state, entries: [entry, ...state.entries], undoStack: [{action:'add', entry}, ...(state.undoStack||[])] }
    await saveState(s)
    setState(s)
    // persist last inputs for this kind (keep inputs filled for next add)
    updateLastInputs(kind, { price: pricePerGram, note, weight })
    
    // Trigger emoji effect
    if (addButtonRef.current) {
      setEmojiEffect({ show: false }); // Reset first
      const rect = addButtonRef.current.getBoundingClientRect()
      // Use setTimeout to ensure state reset is processed
      setTimeout(() => {
        setEmojiEffect({ 
          show: true, 
          x: rect.left + rect.width / 2,
          y: rect.top 
        })
      }, 0)
    }

    // Reset ratings after add
    setRatingLooks(0); setRatingSmell(0); setRatingTouch(0); setRatingTaste(0);
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
    } else if (top.action === 'delete-all' || top.action === 'delete-batch'){
      // restore all deleted entries (put them back on top)
      s.entries = [...top.entries, ...s.entries]
    } else if(top.action==='import'){
      // restore import by removing those imported entries
      s.entries = s.entries.filter(e => !top.entries.some(te => te.id === e.id))
    }
    await saveState(s)
    setState(s)
  }

  async function confirmDeleteAll(){
    if(!state) return
    // require all 5 switches to be ON
    if(!deleteSwitches.every(Boolean)) return
    const deleted = state.entries.slice()
    const s = {...state, entries: [], undoStack: [{ action: 'delete-all', entries: deleted }, ...(state.undoStack||[])] }
    await saveState(s)
    setState(s)
    setShowDeleteModal(false)
    setDeleteSwitches([false,false,false,false,false])
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
    setNotifyEnabled(true
    )
  }

  async function handleImportData(entries) {
    if (!state) return;
    // Mark entries as imported so we can filter them later if needed
    const importedEntries = entries.map(entry => ({ ...entry, imported: true }));
    const s = {
      ...state,
      entries: [...importedEntries, ...state.entries],
      // Add to undo stack as a batch
      undoStack: [{
        action: 'import',
        entries: importedEntries
      }, ...(state.undoStack || [])]
    };
    await saveState(s);
    setState(s);
  }

  async function clearImportedData() {
    if (!state) return;
    const s = {
      ...state,
      entries: state.entries.filter(e => !e.imported),
      undoStack: [{
        action: 'clear-import',
        entries: state.entries.filter(e => e.imported)
      }, ...(state.undoStack || [])]
    };
    await saveState(s);
    setState(s);
  }

  async function handleSetPotency(id, value) {
    if (!state) return;
    const entries = state.entries.map(e => {
      if (e.id === id) {
        return {
          ...e,
          ratings: { ...e.ratings, potency: value },
          pendingPotency: undefined
        };
      }
      return e;
    });
    const s = { ...state, entries };
    await saveState(s);
    setState(s);
    setPendingPotencyId(null);
    setPendingPotencyValue(0);
  }

  // Auto-confirm delete when all switches are turned on
  useEffect(() => {
    if (deleteSwitches.every(Boolean) && showDeleteModal) {
      const t = setTimeout(() => {
        confirmDeleteAll()
      }, 300) // short delay to allow final UI change
      return () => clearTimeout(t)
    }
  }, [deleteSwitches, showDeleteModal])

  // When kind changes, restore last used price and note for that kind
  useEffect(() => {
    if (lastInputs[kind]) {
      setPricePerGram(lastInputs[kind].price || '');
      setNote(lastInputs[kind].note || '');
      setWeight(lastInputs[kind].weight || '');
    }
  }, [kind, lastInputs]);

  if(!state) return <div className="p-4">Loading...</div>

  const totalMoney = state.entries.reduce((s,e)=> s + (e.price||0), 0)
  const totalGrams = state.entries.reduce((s,e)=> s + (e.weight||0), 0)
  const totalJoints = state.entries.length

  function StarRating({ value, onChange, label }) {
    return (
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs w-12 inline-block">{label}</span>
        {[1,2,3,4,5].map(star => (
          <button
            key={star}
            type="button"
            className={
              'text-2xl focus:outline-none ' +
              (value >= star ? 'text-yellow-400' : 'text-gray-300')
            }
            onClick={() => onChange(star)}
            aria-label={label + ' ' + star}
          >★</button>
        ))}
      </div>
    );
  }

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

          <label className="block text-sm font-medium mt-2">Ratings</label>
          <StarRating value={ratingLooks} onChange={setRatingLooks} label="Looks" />
          <StarRating value={ratingSmell} onChange={setRatingSmell} label="Smell" />
          <StarRating value={ratingTouch} onChange={setRatingTouch} label="Touch" />
          <StarRating value={ratingTaste} onChange={setRatingTaste} label="Taste" />

          <label className="block text-sm font-medium mt-2">Note (strain, details, etc)</label>
          <input type="text" value={note} onChange={e=>{
            setNote(e.target.value);
            updateLastInputs(kind, { note: e.target.value })
          }} className="w-full border p-2 rounded" placeholder="e.g. Blue Dream, 22% THC..." />
          <div className="flex space-x-2 mt-3">
            <button 
              ref={addButtonRef}
              onClick={addJoint} 
              className="flex-1 px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400"
            >
              {translations.add}
            </button>
            {emojiEffect.show && (
              <EmojiEffect 
                x={emojiEffect.x} 
                y={emojiEffect.y} 
                onComplete={() => setEmojiEffect({ show: false })}
              />
            )}
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
          <div className="flex space-x-2 flex-wrap gap-y-2">
            <button onClick={undoLast} className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400">Undo last</button>
            <button onClick={()=>setShowDeleteModal(true)} className="px-3 py-1 rounded text-white" style={{ boxShadow: '0 0 12px rgba(255,0,0,0.8), inset 0 0 8px rgba(255,0,0,0.4)', background: 'linear-gradient(90deg,#8b0000,#ff0000)' }}>
              Delete All Data
            </button>
            <button onClick={toggleNotifications} className="px-3 py-1 bg-gray-200 rounded dark:bg-gray-700 dark:text-white dark:border dark:border-purple-400">
              {(notifyEnabled || (state.settings && state.settings.notify)) ? translations.notifyDisable : translations.notifyEnable}
            </button>
            {state.entries.some(e => e.imported) && (
              <button 
                onClick={clearImportedData}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
                title="Remove all imported historical data"
              >
                Clear Imported Data
              </button>
            )}
          </div>
          {(notifyEnabled || (state.settings && state.settings.notify)) && (
            <div className="notify-info-box mt-3">
              {translations.notifyInfo}
            </div>
          )}
          
          <div className="mt-3">
            <QuickDataImport onImport={handleImportData} />
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Brief</h3>
        <div className="space-y-3 mt-2">
          {/* Expected Next Day */}
          <div className="p-3 font-semibold sparkle-animated" style={{
            color: '#fff',
            position: 'relative',
            boxShadow: "0 0 12px 2px #3b82f6, 0 0 24px 4px #60a5fa, 0 0 8px 2px #a5b4fc",
            background: "linear-gradient(90deg, #1e3a8a 40%, #3b82f6 100%)",
            borderRadius: "8px",
            border: "2px solid #3b82f6",
            overflow: "hidden"
          }}>
            <div className="sparkle-overlay sparkle-blue" />
              <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'linear-gradient(90deg,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.18) 100%)',zIndex:2,pointerEvents:'none',mixBlendMode:'multiply'}} />
              <div style={{position:'relative',zIndex:3}} className="flex items-center justify-between">
                <span style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6',fontWeight:'bold'}}>Expected Next Day</span>
                <span style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6',fontWeight:'bold'}}>{(() => {
                  const dates = state.entries.map(e=>e.createdAt)
                  const { alpha, beta } = fitPoissonGamma(dates, {alpha:1,beta:1})
                  const expectedNext = predictiveMean(alpha, beta, 1)
                  return expectedNext ? expectedNext.toFixed(2) : '-';
                })()}</span>
              </div>
          </div>
          {/* Record Weight Joint */}
          <div className="p-3 font-semibold sparkle-animated" style={{
            color: '#fff',
            position: 'relative',
            boxShadow: "0 0 12px 2px #fb923c, 0 0 24px 4px #fbbf24, 0 0 8px 2px #f59e42",
            background: "linear-gradient(90deg, #f59e42 40%, #fb923c 100%)",
            borderRadius: "8px",
            border: "2px solid #fb923c",
            overflow: "hidden"
          }}>
            <div className="sparkle-overlay" style={{background:'linear-gradient(120deg,#fffbe6 0%,#fb923c 40%,#fbbf24 70%,#fffbe6 100%)',opacity:0.35,animation:'pearlBlue 3s ease-in-out infinite'}} />
              <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'linear-gradient(90deg,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.18) 100%)',zIndex:2,pointerEvents:'none',mixBlendMode:'multiply'}} />
              <div style={{position:'relative',zIndex:3}} className="flex items-center justify-between">
                <span style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #fb923c',fontWeight:'bold'}}>Record Weight Joint</span>
                <span style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #fb923c',fontWeight:'bold'}}>{(() => {
                  const weights = state.entries.map(e => e.weight).filter(w => typeof w === 'number' && !isNaN(w));
                  return weights.length ? Math.max(...weights).toFixed(2) + ' g' : '-';
                })()}</span>
              </div>
          </div>
          {/* Joints Smoked Today */}
          <div className="p-3 font-semibold sparkle-animated" style={{
            color: '#fff',
            position: 'relative',
            boxShadow: "0 0 16px 4px #a21caf, 0 0 32px 8px #c084fc, 0 0 12px 4px #7c3aed",
            background: "linear-gradient(90deg, #2e1065 40%, #a21caf 100%)",
            borderRadius: "8px",
            border: "2px solid #a21caf",
            overflow: "hidden"
          }}>
            <div className="sparkle-overlay sparkle-purple" />
              <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'linear-gradient(90deg,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.18) 100%)',zIndex:2,pointerEvents:'none',mixBlendMode:'multiply'}} />
              <div style={{position:'relative',zIndex:3}} className="flex items-center justify-between">
                <span style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #a21caf',fontWeight:'bold'}}>Joints Smoked Today</span>
                <span style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #a21caf',fontWeight:'bold'}}>{(() => {
                  const now = new Date();
                  const last24h = state.entries.filter(e => {
                    const t = new Date(e.createdAt).getTime();
                    return now.getTime() - t < 24*3600000;
                  });
                  return last24h.length;
                })()}</span>
              </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-50" onClick={()=>setShowDeleteModal(false)} />
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 z-60 max-w-lg w-full shadow-2xl" style={{ border: '2px solid rgba(255,0,0,0.6)' }}>
            <h3 className="text-lg font-semibold text-red-600">Confirm Delete All Data</h3>
            <p className="text-sm text-gray-500 mt-2">Turning ON all five switches will immediately delete all joints from local storage. This action can be undone using the Restore feature.</p>
            <div className="mt-4 grid grid-cols-5 gap-3">
              {deleteSwitches.map((v,i)=> (
                <label key={i} className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-8 rounded-full p-1 ${v ? 'bg-red-400' : 'bg-gray-200'}`} style={{ boxShadow: v ? '0 4px 10px rgba(255,0,0,0.6)' : 'inset 0 0 6px rgba(0,0,0,0.05)' }}>
                    <button onClick={()=> setDeleteSwitches(s => s.map((x,idx)=> idx===i ? !x : x)) } className={`w-10 h-6 rounded-full transition-transform ${v ? 'translate-x-4 bg-white' : 'translate-x-0 bg-white'}`} aria-pressed={v} />
                  </div>
                  <div className="text-xs text-gray-600">{`Step ${i+1}`}</div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.entries.some(e => e.pendingPotency) && (
        <div className="card">
          <h3 className="font-semibold text-yellow-700">Pending Potency Ratings</h3>
          <div className="mt-2 space-y-2">
            {state.entries.filter(e => e.pendingPotency).map(e => (
              <div key={e.id} className="flex flex-col gap-1 border-b pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</span>
                  <span className="text-xs text-gray-400">{e.kind}</span>
                  <span className="text-xs text-gray-400">{e.weight}g</span>
                  <span className="text-xs text-gray-400">{state.settings.currency}{(e.price||0).toFixed(2)}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span>Looks: {e.ratings?.looks || '-'}</span>
                  <span>Smell: {e.ratings?.smell || '-'}</span>
                  <span>Touch: {e.ratings?.touch || '-'}</span>
                  <span>Taste: {e.ratings?.taste || '-'}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs">Potency:</span>
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className={
                        'text-2xl focus:outline-none ' +
                        (pendingPotencyId === e.id && pendingPotencyValue >= star ? 'text-green-500' : 'text-gray-300')
                      }
                      onClick={() => { setPendingPotencyId(e.id); setPendingPotencyValue(star); handleSetPotency(e.id, star); }}
                      aria-label={'Potency ' + star}
                    >★</button>
                  ))}
                </div>
              </div>
            ))}
            {state.entries.filter(e => e.pendingPotency).length === 0 && (
              <div className="text-xs text-gray-400">No pending joints.</div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold">Recent</h3>
        <div className="mt-2 space-y-2">
          {state.entries.slice(0,20).map(e=> {
              // Calculate price per gram and band hierarchy
              const pricePerGram = e.weight ? (e.price / e.weight) : 0;
              const weight = typeof e.weight === 'number' ? e.weight : parseFloat(e.weight) || 0;
              let rowClass = "flex flex-col gap-1";
              let effectStyle = {};
              let sparkle = null;
              let heavyVisual = null;
              if (pricePerGram > 45) {
                rowClass += " sparkle-animated sparkle-legendary";
                effectStyle = {
                  boxShadow: "0 0 32px 8px #fff, 0 0 24px 8px #f59e42, 0 0 16px 8px #60a5fa, 0 0 8px 4px #a21caf",
                  background: "linear-gradient(120deg, #fff 0%, #f59e42 10%, #60a5fa 20%, #34d399 30%, #f472b6 40%, #a21caf 50%, #c084fc 60%, #fff 70%, #f59e42 80%, #60a5fa 90%, #fff 100%)",
                  borderRadius: "10px",
                  border: "2px solid #fff",
                  position: "relative",
                  overflow: "hidden"
                };
                sparkle = <div className="sparkle-overlay sparkle-legendary" />;
              } else if (pricePerGram >= 30) {
                rowClass += " luxury-purple-row sparkle-animated";
                effectStyle = {
                  boxShadow: "0 0 16px 4px #a21caf, 0 0 32px 8px #c084fc, 0 0 12px 4px #7c3aed",
                  background: "linear-gradient(90deg, #2e1065 40%, #a21caf 100%)",
                  borderRadius: "8px",
                  border: "2px solid #a21caf",
                  position: "relative",
                  overflow: "hidden"
                };
                sparkle = <div className="sparkle-overlay sparkle-purple" />;
              } else if (pricePerGram > 15 && pricePerGram < 29) {
                rowClass += " neon-blue-row sparkle-animated";
                effectStyle = {
                  boxShadow: "0 0 12px 2px #3b82f6, 0 0 24px 4px #60a5fa, 0 0 8px 2px #a5b4fc",
                  background: "linear-gradient(90deg, #1e3a8a 40%, #3b82f6 100%)",
                  borderRadius: "8px",
                  border: "2px solid #3b82f6",
                  position: "relative",
                  overflow: "hidden"
                };
                sparkle = <div className="sparkle-overlay sparkle-blue" />;
              } else if (weight > 0.75) {
                  rowClass += " luxury-orange-row sparkle-animated";
                  effectStyle = {
                    boxShadow: "0 0 16px 4px #fb923c, 0 0 32px 8px #f59e42, 0 0 12px 4px #fff7ed",
                    background: "linear-gradient(90deg, #fb923c 40%, #f59e42 100%)",
                    borderRadius: "8px",
                    border: "2px solid #fb923c",
                    position: "relative",
                    overflow: "hidden"
                  };
                  // Calculate emoji count
                  let emojiCount = 1;
                  if (weight > 1.2) emojiCount = 2;
                  if (weight > 1.7) emojiCount = 3;
                  if (weight > 2.3) emojiCount = 4;
                  if (weight > 2.8) emojiCount = 5;
                  if (weight > 3.3) emojiCount = 6;
                  if (weight > 3.8) emojiCount = 7;
                  if (weight > 4.3) emojiCount = 8;
                  if (weight > 4.8) emojiCount = 9;
                  if (weight > 5.3) emojiCount = 10;
                  const emoji = '🏋️';
                  heavyVisual = <div style={{fontSize:Math.min(18+emojiCount*4,32),fontWeight:'bold',color:'#fff',textShadow:'0 2px 8px #fb923c,0 0 2px #fff',display:'flex',alignItems:'center',gap:'2px',marginBottom:'2px'}}>{Array(emojiCount).fill(emoji).map((em,i)=>(<span key={i} style={{animation:`floatWeight 2s ${i*0.2}s infinite alternate`}}>{em}</span>))}</div>;
              }
            return (
                  <div key={e.id} className={rowClass} style={effectStyle}>
                    {weight > 0.75 && !(pricePerGram > 45 || pricePerGram >= 30 || (pricePerGram > 15 && pricePerGram < 29)) ? (
                      <div className="sparkle-overlay sparkle-orange" />
                    ) : sparkle}
                      {heavyVisual && (
                        <div style={{position:'relative',zIndex:4}}>{heavyVisual}</div>
                      )}
                    {pricePerGram > 45 ? (
                      <div style={{position:'relative'}}>
                        <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'linear-gradient(90deg,rgba(0,0,0,0.48) 0%,rgba(0,0,0,0.32) 100%)',zIndex:2,pointerEvents:'none',mixBlendMode:'multiply'}} />
                        <div style={{position:'relative',zIndex:3}}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <img src={
                                e.kind==='nug' ? nugImg :
                                e.kind==='hash' ? hashImg :
                                e.kind==='wax' ? waxImg : ''
                              } alt={e.kind} className="w-8 h-8" style={{filter:'drop-shadow(0 2px 12px #000)'}}/>
                              <div>
                                <div className="text-sm flex items-center gap-2" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff',fontWeight:'bold'}}>
                                  {new Date(e.createdAt).toLocaleString()}
                                  {/* THC calculation if note contains a number between 0.1 and 99.9 */}
                                  {(() => {
                                    const match = e.note && e.note.match(/(\d{1,2}(?:[.,]\d{1,2})?)/);
                                    if (match) {
                                      let thcPercent = parseFloat(match[1].replace(',', '.'));
                                      if (thcPercent >= 0.1 && thcPercent <= 99.9 && typeof e.weight === 'number') {
                                        const mgThc = e.weight * 1000 * (thcPercent / 100);
                                        return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold" title="THC mg">{mgThc.toFixed(1)} mg THC</span>;
                                      }
                                    }
                                    return null;
                                  })()}
                                </div>
                                <div className="text-xs" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}> {e.weight} g</div>
                              </div>
                            </div>
                            <div className="text-sm flex items-center space-x-2" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}><div>{state.settings.currency}{(e.price||0).toFixed(2)}</div><button onClick={()=>undoEntry(e.id)} className="px-2 py-1 bg-red-100 rounded text-xs">Undo</button></div>
                          </div>
                          <div className="ml-12">
                            <div className="text-xs flex items-center gap-2" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}>
                              {e.note ? <span>{e.note}</span> : null}
                              {e.ratings && (
                                <span className="flex gap-2 items-center">
                                  {e.ratings.looks ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.looks)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs ml-1" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}>Looks</span></span> : null}
                                  {e.ratings.smell ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.smell)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs ml-1" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}>Smell</span></span> : null}
                                  {e.ratings.touch ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.touch)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs ml-1" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}>Touch</span></span> : null}
                                  {e.ratings.taste ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.taste)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs ml-1" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}>Taste</span></span> : null}
                                  {e.ratings.potency ? <span className="flex gap-1 items-center text-green-500">{[...Array(e.ratings.potency)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs ml-1" style={{color:'#fff',textShadow:'0 6px 24px #000,0 0 6px #fff'}}>Potency</span></span> : null}
                                </span>
                              )}
                              {!e.note && (!e.ratings || (!e.ratings.looks && !e.ratings.smell && !e.ratings.touch && !e.ratings.taste && !e.ratings.potency)) && <span className="italic text-gray-300">No note</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                  ) : (
                    <div style={{position:'relative'}}>
                      <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,background:'linear-gradient(90deg,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.18) 100%)',zIndex:2,pointerEvents:'none',mixBlendMode:'multiply'}} />
                      <div style={{position:'relative',zIndex:3}}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <img src={
                              e.kind==='nug' ? nugImg :
                              e.kind==='hash' ? hashImg :
                              e.kind==='wax' ? waxImg : ''
                            } alt={e.kind} className="w-8 h-8"/>
                            <div>
                              <div className="text-sm flex items-center gap-2" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6',fontWeight:'bold'}}>
                                {new Date(e.createdAt).toLocaleString()}
                                {/* THC calculation if note contains a number between 0.1 and 99.9 */}
                                {(() => {
                                  const match = e.note && e.note.match(/(\d{1,2}(?:[.,]\d{1,2})?)/);
                                  if (match) {
                                    let thcPercent = parseFloat(match[1].replace(',', '.'));
                                    if (thcPercent >= 0.1 && thcPercent <= 99.9 && typeof e.weight === 'number') {
                                      const mgThc = e.weight * 1000 * (thcPercent / 100);
                                      return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold" title="THC mg">{mgThc.toFixed(1)} mg THC</span>;
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="text-xs text-gray-200" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}> {e.weight} g</div>
                            </div>
                          </div>
                          <div className="text-sm flex items-center space-x-2" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}><div>{state.settings.currency}{(e.price||0).toFixed(2)}</div><button onClick={()=>undoEntry(e.id)} className="px-2 py-1 bg-red-100 rounded text-xs">Undo</button></div>
                        </div>
                        <div className="ml-12">
                          <div className="text-xs text-gray-200 flex items-center gap-2" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}>
                            {e.note ? <span>{e.note}</span> : null}
                            {e.ratings && (
                              <span className="flex gap-2 items-center">
                                {e.ratings.looks ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.looks)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs text-gray-200 ml-1" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}>Looks</span></span> : null}
                                {e.ratings.smell ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.smell)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs text-gray-200 ml-1" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}>Smell</span></span> : null}
                                {e.ratings.touch ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.touch)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs text-gray-200 ml-1" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}>Touch</span></span> : null}
                                {e.ratings.taste ? <span className="flex gap-1 items-center text-yellow-500">{[...Array(e.ratings.taste)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs text-gray-200 ml-1" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}>Taste</span></span> : null}
                                {e.ratings.potency ? <span className="flex gap-1 items-center text-green-500">{[...Array(e.ratings.potency)].map((_,i)=>(<span key={i}>★</span>))}<span className="text-xs text-gray-200 ml-1" style={{color:'#fff',textShadow:'0 2px 8px #000,0 0 2px #3b82f6'}}>Potency</span></span> : null}
                              </span>
                            )}
                            {!e.note && (!e.ratings || (!e.ratings.looks && !e.ratings.smell && !e.ratings.touch && !e.ratings.taste && !e.ratings.potency)) && <span className="italic text-gray-300">No note</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
}
