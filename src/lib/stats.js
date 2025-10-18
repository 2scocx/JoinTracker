import { differenceInDays } from 'date-fns'

export function fitPoissonGamma(datesISO, prior={alpha:1,beta:1}){
  if (!datesISO || datesISO.length===0) return { alpha:prior.alpha, beta:prior.beta, N:0, T:0 }
  const dates = datesISO.map(s=>new Date(s))
  const min = new Date(Math.min(...dates.map(d=>d.getTime())))
  const max = new Date(Math.max(...dates.map(d=>d.getTime())))
  const T = Math.max(1, differenceInDays(max,min) || 1)
  const N = dates.length
  return { alpha: prior.alpha + N, beta: prior.beta + T, N, T }
}

export function predictivePMF(k, alpha, beta, t){
  function comb(n,k){ let res=1; for(let i=1;i<=k;i++) res *= (n - k + i)/i; return res }
  const p = beta/(beta + t)
  return comb(k + alpha -1, k) * Math.pow(p, alpha) * Math.pow(1-p, k)
}

export function predictiveMean(alpha,beta,t){ return (t * alpha)/beta }
export const posteriorMean = (a,b)=> a/b
export const posteriorVariance = (a,b)=> a/(b*b)

// gamma PDF for lambda values (posterior)
export function gammaPDF(x, alpha, beta){
  if (x <= 0) return 0
  
  // Work in log space to avoid numerical overflow
  try {
    const logGamma = Math.log(beta) * alpha - logGammaFn(alpha) + 
                     (alpha - 1) * Math.log(x) - beta * x
    return Math.exp(logGamma)
  } catch (e) {
    return 0
  }
}

// Log gamma function using Lanczos approximation
function logGammaFn(z) {
  if (z < 0.5) {
    // Reflection formula
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGammaFn(1 - z)
  }

  // Lanczos coefficients
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ]

  z -= 1
  let x = p[0]
  for (let i = 1; i < p.length; i++) {
    x += p[i] / (z + i)
  }

  const t = z + p.length - 1.5
  return Math.log(Math.sqrt(2 * Math.PI)) +
         (z + 0.5) * Math.log(t) -
         t +
         Math.log(x)
}

// approximate gamma using Lanczos or simple for integer alpha
function gamma(z) {
  // Use Lanczos approximation
  const p = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ]
  
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  }
  
  z -= 1
  let x = 0.99999999999980993
  for (let i = 0; i < p.length; i++) {
    x += p[i] / (z + i + 1)
  }
  const t = z + p.length - 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

// simulate global distribution of lambda (for percentile comparison)
// returns array of sampled lambda from a hypothetical global Gamma distribution
export function simulateGlobalSample(size=1000){
  // choose a plausible global prior: Gamma(alpha=2, beta=1) (mean=2/day)
  const alpha = 2, beta = 1
  const samples = []
  for(let i=0;i<size;i++){
    // sample via inverse transform for gamma with integer alpha: sum of exponentials
    let sum = 0
    for(let k=0;k<alpha;k++){
      sum += -Math.log(Math.random())/beta
    }
    samples.push(sum)
  }
  return samples
}

// compute percentile of value within samples
export function percentileOf(value, samples){
  const s = samples.slice().sort((a,b)=>a-b)
  for(let i=0;i<s.length;i++){ if (value <= s[i]) return (i/s.length)*100 }
  return 100
}
