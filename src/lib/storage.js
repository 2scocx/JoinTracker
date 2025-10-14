import localforage from 'localforage'
const STORE_KEY = 'joint-tracker-state-v4'

export async function loadState(){
  const raw = await localforage.getItem(STORE_KEY)
  if (!raw){
    const init = { version:1, startedAt:new Date().toISOString(), entries:[], settings:{currency:'€', lang:'en'}, undoStack:[] }
    await saveState(init)
    return init
  }
  return raw
}

export async function saveState(s){ await localforage.setItem(STORE_KEY, s) }
export async function clearState(){ await localforage.removeItem(STORE_KEY) }
