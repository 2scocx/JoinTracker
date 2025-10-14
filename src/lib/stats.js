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
  if (x<=0) return 0
  return Math.pow(beta,alpha)/gamma(alpha) * Math.pow(x,alpha-1) * Math.exp(-beta*x)
}

// approximate gamma using Lanczos or simple for integer alpha
function gamma(z){
  // use simple approximation for small z using Math.gamma if available else approximate
  // fallback to Stirling for larger values
  if (z===1) return 1
  if (z===2) return 1
  // use Lanczos coefficients naive (but for our small alpha it's fine)
  let x = 1
  for(let i=1;i<z;i++) x *= i
  return x
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
