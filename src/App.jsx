import React, {useState, useEffect} from 'react'
import Home from './components/Home'
import Stats from './components/Stats'
import HomeIcon from './icons/home.svg'
import ChartIcon from './icons/chart.svg'
import translations from './i18n'
import { loadState, saveState } from './lib/storage'
import backgroundLogo from './assets/local-data-only.png'


export default function App() {
  const [tab, setTab] = useState('home');
  const [lang, setLang] = useState('en');
  // Default to dark mode unless user has a saved preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage && window.localStorage.getItem('joint-tracker-dark');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  // Load language and dark mode from storage
  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (s && s.settings) {
        if (s.settings.lang) setLang(s.settings.lang);
        if (typeof s.settings.darkMode === 'boolean') setDarkMode(s.settings.darkMode);
      }
    })();
  }, []);

  // Update localStorage when darkMode changes
  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (!s.settings) s.settings = {};
      s.settings.darkMode = darkMode;
      await saveState(s);
    })();
    // Set html class for Tailwind dark variant
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Set background logo
    document.documentElement.style.setProperty('--background-logo', `url(${backgroundLogo})`);
    // Also store in localStorage for fast reload
    if (typeof window !== 'undefined') {
      window.localStorage && window.localStorage.setItem('joint-tracker-dark', darkMode ? 'true' : 'false');
    }
  }, [darkMode]);

  async function setLanguage(l) {
    setLang(l);
    const s = await loadState();
    s.settings.lang = l;
    await saveState(s);
  }

  const t = translations[lang] || translations['en'];

  return (
    <div className={
      `min-h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-white' : ''}`
    }>
      <header className={`header p-3 flex flex-col md:flex-row md:items-center md:justify-between ${darkMode ? 'bg-gray-800 text-white' : ''}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:space-x-6 w-full">
          <div className="flex items-center space-x-2">
            <span
              style={{
                color: '#7fff7f',
                textShadow: '0 0 2px #7fff7f, 0 0 1px #fff',
                fontWeight: 900,
                fontFamily: 'Bebas Neue, Oswald, Impact, Arial Black, sans-serif',
                fontSize: '1.7rem',
                letterSpacing: '0.04em',
                paddingRight: 2
              }}
            >Joint</span>
            <span
              style={{
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'Bebas Neue, Oswald, Arial Black, sans-serif',
                fontSize: '1.7rem',
                letterSpacing: '0.04em',
                textShadow: '0 2px 8px #000'
              }}
            >Tracker</span>
            <span
              style={{
                color: '#a78bfa',
                fontWeight: 700,
                fontFamily: 'Oswald, Arial Black, sans-serif',
                fontSize: '1.1rem',
                marginLeft: 8,
                letterSpacing: '0.08em',
                textShadow: '0 2px 8px #000, 0 0 2px #a78bfa',
                opacity: 0.7
              }}
            >by 2scocx</span>
          </div>
          <div className="font-extrabold tracking-widest text-xs md:text-base text-purple-400 mt-1 md:mt-0" style={{letterSpacing:'0.18em',textShadow:'0 2px 8px #000,0 0 2px #a78bfa'}}>
            LOCAL DATA ONLY
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-2 md:mt-0">
          <select value={lang} onChange={e => setLanguage(e.target.value)} className="border p-1 rounded small">
            <option value="en">English</option>
            <option value="it">Italiano</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
          </select>
          <button
            className={`ml-2 px-2 py-1 rounded border text-xs ${darkMode ? 'bg-gray-700 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
            onClick={() => setDarkMode(d => !d)}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☾ Dark' : '☀ Light'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-3 mobile-scroll">
        {tab === 'home' ? <Home translations={t} lang={lang} /> : <Stats translations={t} lang={lang} />}
      </main>

      <nav className={`p-1 flex fixed bottom-4 left-4 right-4 rounded-xl shadow-lg md:hidden ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}` }>
        <button className="tab" onClick={() => setTab('home')} aria-label="home">
          <img src={HomeIcon} alt="home" className="icon mx-auto" />
          <div className="text-xs">Home</div>
        </button>
        <button className="tab" onClick={() => setTab('stats')} aria-label="stats">
          <img src={ChartIcon} alt="stats" className="icon mx-auto" />
          <div className="text-xs">Stats</div>
        </button>
      </nav>
    </div>
  );
}
