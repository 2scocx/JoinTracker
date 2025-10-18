import React, {useEffect, useState} from 'react'
import { loadState } from '../lib/storage'
import { fitPoissonGamma, predictivePMF, predictiveMean, posteriorMean, posteriorVariance, gammaPDF, simulateGlobalSample, percentileOf } from '../lib/stats'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Brush } from 'recharts'
import InfoButton from './InfoButton'

export default function Stats({translations}){
  const [state, setState] = useState(null)
  const [globalSamples, setGlobalSamples] = useState([])
  useEffect(()=>{ (async ()=> setState(await loadState()))(); setGlobalSamples(simulateGlobalSample(2000)) }, [])

  if(!state) return <div className="p-4">Loading...</div>

  // --- Usage stats for each kind ---
  const kindCounts = { herb: 0, hash: 0, wax: 0 };
  state.entries.forEach(e => {
    const k = e.kind === 'nug' ? 'herb' : e.kind;
    if (kindCounts[k] !== undefined) kindCounts[k]++;
  });
  const totalKinds = kindCounts.herb + kindCounts.hash + kindCounts.wax;
  const mostUsedKind = Object.entries(kindCounts).sort((a, b) => b[1] - a[1])[0][0];

  // --- Predict next kind: use the most recent 5 entries, pick the most frequent, fallback to most recent ---
  const recentKinds = state.entries.slice(0, 5).map(e => e.kind === 'nug' ? 'herb' : e.kind);
  let predictedNextKind = null;
  if (recentKinds.length > 0) {
    const freq = { herb: 0, hash: 0, wax: 0 };
    recentKinds.forEach(k => { if (freq[k] !== undefined) freq[k]++; });
    predictedNextKind = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  }
  const dates = state.entries.map(e=>e.createdAt)
  const { alpha, beta, N, T } = fitPoissonGamma(dates, {alpha:1,beta:1})

  // daily counts last 30 days
  const now = new Date()
  const countsMap = {}
  for(let i=29;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth(), now.getDate()-i); countsMap[d.toISOString().slice(0,10)]=0 }
  state.entries.forEach(e=>{ const day=e.createdAt.slice(0,10); if(countsMap[day]!==undefined) countsMap[day] +=1 })
  const daily = Object.keys(countsMap).map(k=>({ date:k.slice(5), count: countsMap[k] }))

  // cumulative spend over time (by entry date sorted)
  const entriesSorted = [...state.entries].sort((a,b)=> new Date(a.createdAt)-new Date(b.createdAt))
  let cum=0
  const cumData = entriesSorted.map(e=>{ cum += (e.price||0); return { date: new Date(e.createdAt).toISOString().slice(0,10), cum: +cum.toFixed(2) } })

  // predictive PMF for next day
  const pmf = Array.from({length:8}).map((_,k)=> ({ k, p: predictivePMF(k, alpha, beta, 1) }))
  const expectedNext = predictiveMean(alpha, beta, 1)
  const postM = posteriorMean(alpha, beta)
  const postV = posteriorVariance(alpha, beta)

  // posterior bell curve data (lambda values)
  const lambdas = []
  // Calculate reasonable x-axis range based on the posterior distribution
  const mean = posteriorMean(alpha, beta)
  const stdDev = Math.sqrt(posteriorVariance(alpha, beta))
  const minX = Math.max(0.01, mean - 3 * stdDev)
  const maxX = mean + 3 * stdDev
  const numPoints = 100
  const step = (maxX - minX) / numPoints

  // Generate points and normalize
  let maxY = 0
  const rawPoints = []
  for(let x = minX; x <= maxX; x += step) {
    const y = gammaPDF(x, alpha, beta)
    if (!isNaN(y) && isFinite(y)) {
      rawPoints.push({ x: +x.toFixed(2), y })
      maxY = Math.max(maxY, y)
    }
  }

  // Normalize y values to ensure visibility and add to final array
  rawPoints.forEach(point => {
    if (maxY > 0) {
      lambdas.push({
        x: point.x,
        y: point.y / maxY  // Normalize to 0-1 range
      })
    }
  })
  // compute percentile of user's rate among simulated global samples
  const userLambda = postM
  const perc = percentileOf(userLambda, globalSamples)

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div>
        {/* Next joint prediction card */}
        <div className="card relative overflow-hidden">
          <div className="flex items-center">
            <h3 className="font-semibold">Previsione prossima canna</h3>
            <InfoButton
              label="Previsione"
              explanation="Questa previsione stima tra quanto tempo (ore/minuti) fumerai la prossima canna, basandosi sulla media degli intervalli tra le tue ultime sessioni. Se hai pochi dati, usa una media globale (4.5h)."
              className="ml-2"
            />
          </div>
          <div className="mt-2 text-lg font-bold text-blue-500">
            {
              (() => {
                const entries = state.entries;
                if (entries.length > 1) {
                  // Get the most recent entry time
                  const lastEntryTime = new Date(entries[0].createdAt).getTime();
                  const now = Date.now();
                  const timeSinceLastEntry = now - lastEntryTime;

                  // Calculate recent average interval (last 24h entries weighted more)
                  let weightedTotal = 0, weightedCount = 0;
                  const recentIntervals = [];
                  
                  for (let i = 0; i < entries.length - 1; ++i) {
                    const t1 = new Date(entries[i].createdAt).getTime();
                    const t2 = new Date(entries[i+1].createdAt).getTime();
                    const interval = Math.abs(t1 - t2);
                    const age = (now - t1) / (24 * 3600000); // age in days
                    const weight = Math.exp(-age); // exponential decay weight
                    
                    weightedTotal += interval * weight;
                    weightedCount += weight;
                    recentIntervals.push(interval);
                  }

                  // Get the weighted average interval
                  const avgMs = weightedTotal / weightedCount;
                  
                  // Calculate predicted time left
                  const msLeft = (lastEntryTime + avgMs) - now;
                  
                  // Format the display string
                  const formatElapsed = (elapsed) => {
                    const d = Math.floor(elapsed / (86400000));
                    const h = Math.floor((elapsed % 86400000) / 3600000);
                    const m = Math.floor((elapsed % 3600000) / 60000);
                    const s = Math.floor((elapsed % 60000) / 1000);
                    let parts = []
                    if (d > 0) parts.push(`${d}g`)
                    if (h > 0) parts.push(`${h}h`)
                    if (m > 0) parts.push(`${m}m`)
                    if (s > 0 && parts.length === 0) parts.push(`${s}s`)
                    return parts.join(' ')
                  }

                  if (msLeft <= -300000) { // If more than 5 minutes past prediction
                    const elapsed = -msLeft;
                    const timeStr = formatElapsed(elapsed);
                    // Use translation for past prediction, injecting the formatted time
                    if (translations && translations.predictedPast) {
                      return translations.predictedPast.replace('{time}', timeStr)
                    }
                    return `Hai fumato ${timeStr} fa — traccia la tua canna!`
                  } else if (msLeft <= 0) { // Within 5 minutes of prediction
                    // Use translation for predictedNow if available
                    if (translations && translations.predictedNow) return translations.predictedNow
                    return "Crediamo che tu stia fumando ora"
                  } else { // Future prediction
                    const h = Math.floor(msLeft / 3600000);
                    const m = Math.round((msLeft % 3600000) / 60000);
                    return `Tra circa ${h}h ${m}m`
                  }
                } else {
                  return 'Tra circa 4h 30m (stima globale)';
                }
              })()
            }
          </div>
          <div className="mt-2 text-xs text-gray-400 italic">
            La previsione si aggiorna in tempo reale e si adatta alle tue abitudini.
          </div>
      </div>
        <div className="flex items-center mt-4">
          <h3 className="font-semibold">Tipo più usato</h3>
          <InfoButton
            label="Tipo più usato"
            explanation="Mostra quanti joints hai tracciato per ciascun tipo (Herb, Hash, Wax) e quale preferisci. Il colore indica il tipo."
            className="ml-2"
          />
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:space-x-6 text-base md:text-lg mt-2">
          <span className="font-bold text-purple-500">{kindCounts.herb} Herb</span>
          <span className="font-bold text-yellow-700">{kindCounts.hash} Hash</span>
          <span className="font-bold text-orange-500">{kindCounts.wax} Wax</span>
        </div>
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {mostUsedKind === 'herb' && 'Preferisci l’Herb.'}
          {mostUsedKind === 'hash' && 'Preferisci l’Hash.'}
          {mostUsedKind === 'wax' && 'Preferisci il Wax.'}
        </div>
        <div className="mt-2 text-xs text-gray-400 italic">
          {totalKinds === 0 ? 'Nessun dato.' : `Su ${totalKinds} joints tracciati.`}
        </div>
        <div className="mt-4 text-base font-semibold text-blue-500">
          {predictedNextKind ? (
            <span>Prossima canna prevista: <span className={
              predictedNextKind==='herb' ? 'text-purple-500' : predictedNextKind==='hash' ? 'text-yellow-700' : 'text-orange-500'
            }>{predictedNextKind.toUpperCase()}</span></span>
          ) : '—'}
        </div>
      </div>
      <div className="card">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold">{translations.statsConsumptionOverview}</h2>
          <InfoButton
            label="Panoramica consumo"
            explanation="Riepilogo dei giorni osservati e joints totali. La media a posteriori (λ) stima il tuo tasso giornaliero, la varianza indica quanto varia il consumo. 'Expected next day' è la previsione per il prossimo giorno."
            className="ml-2"
          />
        </div>
        <div className="mt-2 text-sm text-gray-500">{translations.statsObservedDays}: {Object.keys(countsMap).length} • {translations.joints}: {N}</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="text-left">
            <div className="text-xs text-gray-700 dark:text-gray-300">{translations.statsPosteriorMean}</div>
            <div className="text-lg font-medium text-blue-500">{postM.toFixed(3)} /day</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{translations.statsVariance} {postV.toFixed(4)}</div>
          </div>
          <div className="text-left">
            <div className="text-xs text-gray-700 dark:text-gray-300">{translations.statsExpectedNext}</div>
            <div className="text-lg font-medium text-blue-500">{expectedNext.toFixed(2)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{translations.statsPredictivePMF}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <h3 className="font-semibold">{translations.statsPosteriorDistribution}</h3>
          <InfoButton
            label="Distribuzione a posteriori"
            explanation="Questa curva mostra la distribuzione stimata del tuo tasso di consumo giornaliero (λ). Più è alta la curva, più probabile è quel valore di λ."
            className="ml-2"
          />
        </div>
        <div style={{width:'100%', height:180}}>
          <ResponsiveContainer>
            <LineChart data={lambdas}>
              <XAxis 
                dataKey="x"
                domain={['auto', 'auto']}
                tickFormatter={(value) => value.toFixed(1)}
              />
              <YAxis 
                domain={[0, 1]}
                hide={true}
              />
              <Tooltip 
                formatter={(value, name) => [value.toFixed(3), 'Probability Density']}
                labelFormatter={(label) => `λ = ${Number(label).toFixed(2)}`}
              />
              <Line 
                type="monotone" 
                dataKey="y" 
                stroke="#06b6d4" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-sm text-gray-500">{translations.statsPercentile}: {perc.toFixed(1)} — {translations.statsGlobalComparison}</div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <h3 className="font-semibold">{translations.statsDailyCounts}</h3>
          <InfoButton
            label="Conteggi giornalieri"
            explanation="Grafico a barre che mostra quanti joints hai tracciato ogni giorno negli ultimi 30 giorni. Utile per vedere i picchi di consumo."
            className="ml-2"
          />
        </div>
        <div style={{width:'100%', height:160}}>
          <ResponsiveContainer>
            <BarChart data={daily}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <h3 className="font-semibold">{translations.statsCumulativeSpend}</h3>
          <InfoButton
            label="Spesa cumulativa"
            explanation="Linea che mostra quanto hai speso in totale nel tempo, sommando ogni acquisto. Utile per monitorare la spesa complessiva."
            className="ml-2"
          />
        </div>
        <div style={{width:'100%', height:160}}>
          <ResponsiveContainer>
            <LineChart data={cumData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="cum" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center">
          <h3 className="font-semibold">Peso delle canne</h3>
          <InfoButton
            label="Statistiche sul peso"
            explanation="Visualizza il trend del peso medio delle canne per giorno, la distribuzione dei pesi, la media, la varianza e la canna più pesante. Utile per capire se stai aumentando o diminuendo la dose."
            className="ml-2"
          />
        </div>
        {/* Calcolo dati peso */}
        {(() => {
          // Raggruppa per giorno
          const weightByDay = {};
          state.entries.forEach(e => {
            const day = e.createdAt.slice(0,10);
            if (!weightByDay[day]) weightByDay[day] = [];
            if (typeof e.weight === 'number' && !isNaN(e.weight)) weightByDay[day].push(e.weight);
          });
          const avgWeightData = Object.keys(weightByDay).map(day => ({
            date: day.slice(5),
            avg: weightByDay[day].length ? (weightByDay[day].reduce((a,b)=>a+b,0)/weightByDay[day].length) : 0
          })).sort((a,b)=>a.date.localeCompare(b.date));

          // Istogramma distribuzione pesi
          const bins = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0];
          const hist = bins.map(bin => ({
            bin: bin,
            count: state.entries.filter(e => e.weight >= bin-0.05 && e.weight < bin+0.05).length
          }));

          // Statistiche
          const weights = state.entries.map(e => e.weight).filter(w => typeof w === 'number' && !isNaN(w));
          const mean = weights.length ? (weights.reduce((a,b)=>a+b,0)/weights.length) : 0;
          const variance = weights.length ? (weights.reduce((a,b)=>a+(b-mean)*(b-mean),0)/weights.length) : 0;
          const maxWeight = weights.length ? Math.max(...weights) : 0;
          return (
            <>
              <div className="mt-2 text-sm text-gray-500">Media: <span className="font-bold text-blue-500">{mean.toFixed(2)} g</span> • Varianza: <span className="font-bold text-blue-500">{variance.toFixed(3)}</span> • Record: <span className="font-bold text-orange-500">{maxWeight.toFixed(2)} g</span></div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={{width:'100%', height:200}}>
                  <ResponsiveContainer>
                    <LineChart data={avgWeightData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="avg" stroke="#a78bfa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{width:'100%', height:200}}>
                  <ResponsiveContainer>
                    <BarChart data={hist}>
                      <XAxis dataKey="bin" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      <div className="card">
        <div className="flex items-center">
          <h3 className="font-semibold">Predictive distribution (next day)</h3>
          <InfoButton
            label="Distribuzione predittiva"
            explanation="Questa distribuzione mostra la probabilità di fumare 0, 1, 2... joints il prossimo giorno, secondo il modello statistico Poisson-Gamma."
            className="ml-2"
          />
        </div>
        <div style={{width:'100%', height:160}}>
          <ResponsiveContainer>
            <BarChart data={pmf}>
              <XAxis dataKey="k" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="p" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-sm text-gray-500">This uses a Gamma prior (α=1, β=1) and Poisson likelihood. The predictive is Poisson-Gamma (negative binomial form).</div>
      </div>
    </div>
  )
}
