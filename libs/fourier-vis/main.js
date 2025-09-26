import WebFFT from 'https://cdn.jsdelivr.net/npm/webfft@1.0.3/lib/main.js';
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const nextPow2=n=>1<<Math.max(3,Math.ceil(Math.log2(Math.max(8,n|0))));
const isPow2=n=>n>0 && (n & (n-1))===0;
const DISPLAY_MAX=255;
const to255=v=>Math.round(clamp(v,0,DISPLAY_MAX)*255/DISPLAY_MAX);
const LOG_DRAW_FULL=Math.log1p(DISPLAY_MAX);
const LOG_DISPLAY_MAX=LOG_DRAW_FULL;
const TWO_PI=Math.PI*2;
const PHASE_MIN_RAD=0;
const PHASE_MAX_RAD=TWO_PI;
function toast(message, {duration=1500, type='normal', persist=false, html=false}={}){
  const el=document.getElementById('toast');
  if(!el) return;
  if(html) el.innerHTML=message;
  else el.textContent=message;
  el.classList.remove('error','warning');
  if(type==='error') el.classList.add('error');
  else if(type==='warning') el.classList.add('warning');
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._persist=persist;
  if(!persist){
    toast._t=setTimeout(()=>{
      el.classList.remove('show');
      toast._persist=false;
    }, duration);
  }else{
    toast._t=null;
  }
}

function hideToast(){
  const el=document.getElementById('toast');
  if(!el) return;
  clearTimeout(toast._t);
  toast._t=null;
  toast._persist=false;
  el.classList.remove('show');
}

function attachSliderWithWheel(input, onChange){
  const step=Number(input.step)||1;
  const min=input.min!==''?Number(input.min):-Infinity;
  const max=input.max!==''?Number(input.max):Infinity;
  const decimals=input.step&&input.step.includes('.')?input.step.split('.')[1].length:0;
  const formatter=decimals>0?(v)=>v.toFixed(decimals):(v)=>String(Math.round(v));
  input.addEventListener('input', ()=>{
    const value=Number(input.value);
    onChange(value);
  });
  input.addEventListener('wheel', e=>{
    e.preventDefault();
    const delta=e.deltaY<0?step:-step;
    const current=Number(input.value);
    let next=clamp(current+delta,min,max);
    if(decimals>0) next=Number(next.toFixed(decimals));
    input.value=formatter(next);
    onChange(next);
  }, {passive:false});
}

function wrapToPi(angle){
  if(angle > Math.PI) return Math.PI;
  if(angle < -Math.PI) return -Math.PI;
  return angle;
}

function wrapToTwoPi(angle){
  return angle + Math.PI;
}

let webfftInstance=null;
let fftSizeX=0;

function disposeFft(){
  if(webfftInstance){
    try{ webfftInstance.dispose(); }catch(err){ console.warn('FFT dispose failed', err); }
    webfftInstance=null;
  }
  fftSizeX=0;
  forwardInputRows=null;
  freqConjRows=null;
  freqInputRows=null;
}

function ensureFft(){
  if(webfftInstance && fftSizeX===W) return;
  disposeFft();
  webfftInstance=new WebFFT(W, 'indutnyModifiedJavascript', false);
  fftSizeX=W;
}

function fftshift2D(src,W,H){
  const dst=new src.constructor(src.length), hx=W>>1, hy=H>>1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=(x+hx)&(W-1), sy=(y+hy)&(H-1); dst[y*W+x]=src[sy*W+sx]}
  return dst;
}
const ifftshift2D=fftshift2D;

function forwardFFT2D(){
  ensureFft();
  if(!forwardInputRows || forwardInputRows.length!==H || forwardInputRows?.[0]?.length!==2*W){
    forwardInputRows=new Array(H);
    for(let y=0;y<H;y++) forwardInputRows[y]=new Float32Array(2*W);
  }
  for(let y=0;y<H;y++){
    const row=forwardInputRows[y];
    const offset=y*W;
    for(let x=0;x<W;x++){
      const idx=offset+x;
      row[2*x]=img[idx];
      row[2*x+1]=0;
    }
  }
  return webfftInstance.fft2d(forwardInputRows);
}

function inverseFFT2D(freqRows){
  ensureFft();
  if(!freqConjRows || freqConjRows.length!==H || freqConjRows?.[0]?.length!==2*W){
    freqConjRows=new Array(H);
    for(let y=0;y<H;y++) freqConjRows[y]=new Float32Array(2*W);
  }
  for(let y=0;y<H;y++){
    const src=freqRows[y];
    const dst=freqConjRows[y];
    for(let i=0;i<src.length;i+=2){
      dst[i]=src[i];
      dst[i+1]=-src[i+1];
    }
  }
  const forward=webfftInstance.fft2d(freqConjRows);
  const total=totalSize;
  for(let y=0;y<H;y++){
    const row=forward[y];
    for(let i=0;i<row.length;i+=2){
      row[i]=row[i]/total;
      row[i+1]=-row[i+1]/total;
    }
  }
  return forward;
}


const canvImage=document.getElementById('image');
const canvFreq =document.getElementById('freq');
const canvPhase=document.getElementById('phase');
const overImg  =document.getElementById('overlayImage');
const overFft  =document.getElementById('overlayFreq');
const overPhase=document.getElementById('overlayPhase');
const ctxImg=canvImage.getContext('2d',{willReadFrequently:true});
const ctxFft=canvFreq.getContext('2d',{willReadFrequently:true});
const ctxPhase=canvPhase.getContext('2d',{willReadFrequently:true});
const octxImg=overImg.getContext('2d');
const octxFft=overFft.getContext('2d');
const octxPhase=overPhase.getContext('2d');

const refreshToggle=document.getElementById('refreshToggle');
const refreshModeLabel=document.getElementById('refreshModeLabel');
const uploadBtn=document.getElementById('uploadBtn');
const uploadInput=document.getElementById('uploadInput');
const brushPowerInput=document.getElementById('brushPower');
const brushPowerValue=document.getElementById('brushPowerValue');
const brushSizeLabel=document.getElementById('brushSizeLabel');
const sizeInput=document.getElementById('size');
const tripleGroup=document.getElementById('tripleGroup');
const phaseToggle=document.getElementById('phaseToggle');
const introModal=document.getElementById('introModal');
const introDismiss=document.getElementById('introDismiss');
const helpBtn=document.getElementById('helpBtn');
const helpModal=document.getElementById('helpModal');
const helpClose=document.getElementById('helpClose');
const domainsCard=document.getElementById('domainsCard');
const domainsResizeHandle=document.getElementById('domainsResizeHandle');
const imageScaleToggle=document.getElementById('imageScaleToggle');
const imageColorbarMax=document.getElementById('imageColorbarMax');
const imageColorbarMin=document.getElementById('imageColorbarMin');
const imageColorbarElement=document.querySelector('.colorBar--intensity');
const imageDynamicRail=document.getElementById('imageDynamicRail');
const imageDynamicHandleLower=document.getElementById('imageDynamicHandleLower');
const imageDynamicHandleUpper=document.getElementById('imageDynamicHandleUpper');
const freqColorbarMax=document.getElementById('freqColorbarMax');
const freqColorbarMin=document.getElementById('freqColorbarMin');
const freqColorbarElement=document.querySelector('.colorBar--magnitude');
const freqLogButton=document.getElementById('freqLogButton');

let W=nextPow2(parseInt(document.getElementById('size').value,10));
let H=W;
let totalSize=W*H;

let img=new Float64Array(W*H);
let re =new Float64Array(W*H);
let im =new Float64Array(W*H);
let mag=new Float64Array(W*H);
let magLog=new Float64Array(W*H);
let phase=new Float64Array(W*H);
let magShiftedLog=new Float64Array(W*H);
let magShiftedLinear=new Float64Array(W*H);
let phaseWrapped=new Float64Array(W*H);
let phaseShiftedDisplay=new Float64Array(W*H);
let freqSyncScheduled=false, freqSyncHandle=null, freqNeedsSync=false;

const IMAGE_MIN=0;
const IMAGE_MAX=DISPLAY_MAX;
const FREQUENCY_FIXED_MIN=0;
const FREQUENCY_FIXED_MAX=LOG_DISPLAY_MAX;
const SCALE_EPSILON=1e-6;
const MIN_DYNAMIC_SPAN=(IMAGE_MAX-IMAGE_MIN)*0.5;

const scalingState={
  image:{
    key:'image',
    name:'Image Domain',
    dynamic:false,
    dynamicLower:IMAGE_MIN,
    dynamicUpper:IMAGE_MAX,
    rangeInitialized:false,
    domainMin:IMAGE_MIN,
    domainMax:IMAGE_MAX,
    lastStats:{min:IMAGE_MIN, max:IMAGE_MAX},
    fixedRange:{min:IMAGE_MIN, max:IMAGE_MAX},
    labelMin:imageColorbarMin,
    labelMax:imageColorbarMax,
    toggle:imageScaleToggle,
    slider:{
      rail:imageDynamicRail,
      lower:imageDynamicHandleLower,
      upper:imageDynamicHandleUpper,
      colorbar:imageColorbarElement,
      dragging:null
    },
    lastErrorShown:false
  },
  freq:{
    key:'freq',
    name:'Frequency Domain (Magnitude)',
    logScale:true,
    lastStats:{min:0, max:1},
    labelMin:freqColorbarMin,
    labelMax:freqColorbarMax,
    button:freqLogButton,
    colorbar:freqColorbarElement
  }
};

let activeWarning=null;

function computeStats(values,fallbackMin=0,fallbackMax=1){
  let min=Infinity;
  let max=-Infinity;
  for(let i=0;i<values.length;i++){
    const v=values[i];
    if(v<min) min=v;
    if(v>max) max=v;
  }
  if(!Number.isFinite(min)) min=fallbackMin;
  if(!Number.isFinite(max)) max=fallbackMax;
  return {min, max};
}

function mixColors(colorA, colorB, ratio){
  const t=clamp(ratio,0,1);
  return [
    clamp(Math.round(colorA[0]*(1-t)+colorB[0]*t), 0, 255),
    clamp(Math.round(colorA[1]*(1-t)+colorB[1]*t), 0, 255),
    clamp(Math.round(colorA[2]*(1-t)+colorB[2]*t), 0, 255)
  ];
}

function mixChannel(base, target, ratio){
  const t=clamp(ratio,0,1);
  return clamp(Math.round(base*(1-t)+target*t), 0, 255);
}

function colorToCss(color){
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function getDisplayRange(domainKey, stats){
  if(domainKey==='image'){
    const state=scalingState.image;
    if(!state.dynamic) return state.fixedRange;
    const bounds=enforceImageDynamicBounds(state.dynamicLower, state.dynamicUpper);
    state.dynamicLower=bounds.lower;
    state.dynamicUpper=bounds.upper;
    return {min:state.dynamicLower, max:state.dynamicUpper};
  }
  if(domainKey==='freq'){
    const state=scalingState.freq;
    if(state.logScale) return {min:FREQUENCY_FIXED_MIN, max:FREQUENCY_FIXED_MAX};
    const max=Math.max(stats.max, 1);
    return {min:0, max};
  }
  return {min:stats.min, max:stats.max};
}

function formatLabel(domainKey,value){
  if(domainKey==='freq') return value.toFixed(2);
  return Math.round(value).toString();
}

function updateColorbarLabels(domainKey, displayRange, stats){
  const state=scalingState[domainKey];
  const {labelMax,labelMin}=state;
  if(!labelMax || !labelMin) return;
  const fallback=displayRange || {};
  const currentStats=stats || state.lastStats || fallback;
  const statMin=Number.isFinite(currentStats?.min)?currentStats.min:fallback.min;
  const statMax=Number.isFinite(currentStats?.max)?currentStats.max:fallback.max;

  if(domainKey==='image'){
    if(state.dynamic){
      const lower=formatClampValue(state.dynamicLower);
      const upper=formatClampValue(state.dynamicUpper);
      labelMin.textContent=lower;
      labelMax.textContent=upper;
      labelMin.setAttribute('title', `Image min ${formatClampValue(statMin ?? state.dynamicLower)} • Scale lower ${lower}`);
      labelMax.setAttribute('title', `Image max ${formatClampValue(statMax ?? state.dynamicUpper)} • Scale upper ${upper}`);
      labelMin.dataset.scaleValue=lower;
      labelMax.dataset.scaleValue=upper;
    }else{
      labelMin.textContent='0';
      labelMax.textContent='255';
      labelMin.removeAttribute('title');
      labelMax.removeAttribute('title');
      labelMin.removeAttribute('data-scale-value');
      labelMax.removeAttribute('data-scale-value');
    }
  }else if(domainKey==='freq'){
    const minValue=Number.isFinite(statMin)?statMin:fallback.min;
    const maxValue=Number.isFinite(statMax)?statMax:fallback.max;
    labelMin.textContent=formatLabel(domainKey, minValue ?? 0);
    labelMax.textContent=formatLabel(domainKey, maxValue ?? 0);
    labelMin.title=`Magnitude min ${labelMin.textContent}`;
    labelMax.title=`Magnitude max ${labelMax.textContent}`;
  }
  labelMax.classList.toggle('colorBar__label--draggable', state.dynamic && domainKey!=='image');
}

function domainHasOutOfRange(domainKey, stats){
  if(domainKey==='image'){
    const state=scalingState.image;
    if(state.dynamic) return false;
    const fixed=state.fixedRange;
    return stats.max>fixed.max+SCALE_EPSILON || stats.min<fixed.min-SCALE_EPSILON;
  }
  return false;
}

function handleRangeError(domainKey, violated, stats){
  if(domainKey==='image'){
    const state=scalingState.image;
    if(state.dynamic){
      state.lastErrorShown=false;
      dismissImageClampWarning();
      return;
    }
    if(violated){
      showImageClampWarning(stats);
    }else{
      dismissImageClampWarning();
      state.lastErrorShown=false;
    }
  }
}

function rerenderDomain(domainKey){
  if(domainKey==='image') renderImage();
  else if(domainKey==='freq') renderFreq();
}

function setDynamicScaling(domainKey, enabled){
  const state=scalingState[domainKey];
  if(state.dynamic===enabled) return;
  state.dynamic=enabled;
  if(domainKey==='image'){
    if(enabled){
      dismissImageClampWarning();
      if(!state.rangeInitialized){
        state.dynamicLower=IMAGE_MIN;
        state.dynamicUpper=IMAGE_MAX;
        state.rangeInitialized=true;
      }
    }
    updateImageDynamicDisplay();
  }else{
    if(state.overrideMax!==undefined) state.overrideMax=null;
    if(state.drag){
      state.drag.active=false;
      state.drag.startStats=null;
    }
  }
  if(state.toggle) state.toggle.checked=enabled;
  const displayRange=getDisplayRange(domainKey, state.lastStats);
  updateColorbarLabels(domainKey, displayRange, state.lastStats);
  rerenderDomain(domainKey);
  saveSettings();
}

function applyScalingSettings(config){
  const imageConfig=config?.image || {};
  const freqConfig=config?.freq || {};

  scalingState.image.dynamic=Boolean(imageConfig.dynamic);
  if(Number.isFinite(imageConfig.dynamicLower)){
    scalingState.image.dynamicLower=clamp(imageConfig.dynamicLower, IMAGE_MIN, IMAGE_MAX);
  }
  if(Number.isFinite(imageConfig.dynamicUpper)){
    scalingState.image.dynamicUpper=clamp(imageConfig.dynamicUpper, IMAGE_MIN, IMAGE_MAX);
  }
  scalingState.image.rangeInitialized=Boolean(imageConfig.rangeInitialized);
  if(scalingState.image.toggle){
    scalingState.image.toggle.checked=scalingState.image.dynamic;
  }
  if(scalingState.image.dynamic && !scalingState.image.rangeInitialized){
    const stats=scalingState.image.lastStats;
    const bounds=enforceImageDynamicBounds(stats.min, stats.max);
    scalingState.image.dynamicLower=bounds.lower;
    scalingState.image.dynamicUpper=bounds.upper;
    scalingState.image.rangeInitialized=true;
  }
  updateImageDynamicDisplay();
  scalingState.freq.logScale=Boolean(freqConfig.logScale);
  if(scalingState.freq.button){
    scalingState.freq.button.setAttribute('aria-pressed', String(scalingState.freq.logScale));
  }

  updateColorbarLabels('image', getDisplayRange('image', scalingState.image.lastStats), scalingState.image.lastStats);
  updateFrequencyColorbarDisplay(scalingState.freq.lastStats, getDisplayRange('freq', scalingState.freq.lastStats));
}

function attachScalingControls(){
  if(!attachScalingControls._attached){
    if(scalingState.image.toggle){
      scalingState.image.toggle.addEventListener('change', e=>{
        const checked=Boolean(e.target?.checked);
        setDynamicScaling('image', checked);
      });
    }
    if(scalingState.freq.button){
      scalingState.freq.button.addEventListener('click', ()=>{
        setFrequencyLogScale(!scalingState.freq.logScale);
      });
    }
    attachScalingControls._attached=true;
  }
  attachImageDynamicSlider();
}

function formatClampValue(value){
  if(!Number.isFinite(value)) return '—';
  if(Math.abs(value) >= 1000) return value.toFixed(0);
  if(Math.abs(value) >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

function clampImageValuesDown(){
  let changed=false;
  for(let i=0;i<img.length;i++){
    const v=img[i];
    const clampedValue=clamp(v, IMAGE_MIN, IMAGE_MAX);
    if(clampedValue!==v){
      img[i]=clampedValue;
      changed=true;
    }
  }
  if(!changed){
    dismissImageClampWarning();
    return;
  }
  renderImage();
  imgNeedsSync=true;
  flushImageSync();
}

function dismissImageClampWarning(){
  if(activeWarning!=='image-clamp') return;
  activeWarning=null;
  hideToast();
  scalingState.image.lastErrorShown=false;
}

function showImageClampWarning(stats){
  const minLabel=formatClampValue(stats.min);
  const maxLabel=formatClampValue(stats.max);
  const message=[
    '<div class="toast__body">',
    '<p class="toast__title">Image values are clamped</p>',
    `<p class="toast__subtitle">Min value: <strong>${minLabel}</strong> &bull; Max value: <strong>${maxLabel}</strong></p>`,
    '</div>',
    '<div class="toast__actions">',
    '<button type="button" class="toast__btn" data-action="enable-dynamic">Enable dynamic scale</button>',
    '<button type="button" class="toast__btn" data-action="clamp-values">Clamp the values down</button>',
    '</div>'
  ].join('');
  toast(message, {type:'warning', persist:true, html:true});
  activeWarning='image-clamp';
  scalingState.image.lastErrorShown=true;
  const el=document.getElementById('toast');
  if(!el) return;
  const enableBtn=el.querySelector('[data-action="enable-dynamic"]');
  if(enableBtn){
    enableBtn.onclick=()=>{
      setDynamicScaling('image', true);
      dismissImageClampWarning();
    };
  }
  const clampBtn=el.querySelector('[data-action="clamp-values"]');
  if(clampBtn){
    clampBtn.onclick=()=>{
      clampImageValuesDown();
    };
  }
}

const imageStack=canvImage?.closest('.stack') || null;
const imageClampSubtitle=document.getElementById('imageClampSubtitle');

function updateImageClampDecorations(isClamped, stats){
  if(canvImage){
    canvImage.classList.toggle('base--clamped', Boolean(isClamped));
  }
  if(imageStack){
    imageStack.classList.toggle('stack--clamped', Boolean(isClamped));
  }
  if(imageClampSubtitle){
    if(isClamped){
      imageClampSubtitle.hidden=false;
      imageClampSubtitle.textContent=`Min value is ${formatClampValue(stats.min)} · Max value is ${formatClampValue(stats.max)}`;
    }else{
      imageClampSubtitle.hidden=true;
      imageClampSubtitle.textContent='';
    }
  }
}

function enforceImageDynamicBounds(lower, upper){
  const state=scalingState.image;
  const domainMin=Number.isFinite(state.domainMin)?state.domainMin:IMAGE_MIN;
  const domainMax=Number.isFinite(state.domainMax)?state.domainMax:IMAGE_MAX;
  let nextLower=Number.isFinite(lower)?lower:domainMin;
  let nextUpper=Number.isFinite(upper)?upper:domainMax;
  const domainSpan=Math.max(domainMax-domainMin, SCALE_EPSILON);
  const minSpan=Math.min(Math.max(MIN_DYNAMIC_SPAN, SCALE_EPSILON), domainSpan);
  if(nextUpper - nextLower < minSpan){
    const mid=(nextLower+nextUpper)/2;
    nextLower=mid - minSpan/2;
    nextUpper=mid + minSpan/2;
  }
  nextLower=clamp(nextLower, domainMin, domainMax - minSpan);
  nextUpper=clamp(nextUpper, nextLower + minSpan, domainMax);
  return {lower:nextLower, upper:nextUpper};
}

function updateImageDynamicDisplay(){
  const state=scalingState.image;
  const slider=state.slider;
  const colorbar=slider?.colorbar;
  if(!colorbar){
    if(slider?.rail) slider.rail.hidden=true;
    return;
  }
  if(!state.dynamic){
    colorbar.classList.remove('colorBar--dynamic');
    colorbar.style.background='';
    if(slider?.rail) slider.rail.hidden=true;
    if(slider?.lower){
      slider.lower.style.removeProperty('--offset');
      slider.lower.removeAttribute('data-value');
      slider.lower.removeAttribute('data-active');
      slider.lower.removeAttribute('title');
    }
    if(slider?.upper){
      slider.upper.style.removeProperty('--offset');
      slider.upper.removeAttribute('data-value');
      slider.upper.removeAttribute('data-active');
      slider.upper.removeAttribute('title');
    }
    return;
  }
  colorbar.classList.add('colorBar--dynamic');
  if(slider?.rail) slider.rail.hidden=false;
  const domainMin=Number.isFinite(state.domainMin)?state.domainMin:IMAGE_MIN;
  const domainMax=Number.isFinite(state.domainMax)?state.domainMax:IMAGE_MAX;
  const domainSpan=Math.max(domainMax-domainMin, SCALE_EPSILON);
  const pctFor=value=>Math.max(0, Math.min(100, ((value-domainMin)/domainSpan)*100));
  const lowerPct=pctFor(state.dynamicLower);
  const upperPct=pctFor(state.dynamicUpper);
  const maxUnderDiff=Math.max(state.dynamicLower - domainMin, 0);
  const maxOverDiff=Math.max(domainMax - state.dynamicUpper, 0);
  const neutralWhite=[255,255,255];
  const redDeep=[255,32,32];
  const blueDeep=[32,120,255];
  const pushStop=(stops, percent, color)=>{
    const clamped=Math.max(0, Math.min(100, percent));
    const idx=stops.findIndex(entry=>Math.abs(entry.percent-clamped)<0.01);
    if(idx>=0) stops[idx]={percent:clamped,color};
    else stops.push({percent:clamped,color});
  };
  const gradientStops=[];
  const denomUnder=maxUnderDiff>0?Math.log1p(maxUnderDiff):0;
  const denomOver=maxOverDiff>0?Math.log1p(maxOverDiff):0;

  if(lowerPct>0.01){
    const lowerSamples=[0,0.45,0.85];
    lowerSamples.forEach(sample=>{
      const percent=lowerPct*sample;
      const value=domainMin + (percent/100)*domainSpan;
      const diff=Math.max(state.dynamicLower - value, 0);
      const ratio=denomUnder>0 && diff>0?Math.log1p(diff)/denomUnder:0;
      const color=colorToCss(mixColors(neutralWhite, blueDeep, ratio));
      pushStop(gradientStops, percent, color);
    });
  }else{
    pushStop(gradientStops, 0, colorToCss(neutralWhite));
  }
  pushStop(gradientStops, lowerPct, 'rgb(0,0,0)');

  const midPct=lowerPct + (upperPct - lowerPct)/2;
  pushStop(gradientStops, Math.max(lowerPct, 0), 'rgb(0,0,0)');
  pushStop(gradientStops, Math.max(midPct, lowerPct), 'rgb(128,128,128)');
  pushStop(gradientStops, Math.min(upperPct, 100), 'rgb(255,255,255)');

  pushStop(gradientStops, upperPct, 'rgb(255,255,255)');
  if(upperPct<99.99){
    const upperSamples=[0.15,0.55,1];
    upperSamples.forEach(sample=>{
      const percent=upperPct + (100-upperPct)*sample;
      const value=domainMin + (percent/100)*domainSpan;
      const diff=Math.max(value - state.dynamicUpper, 0);
      const ratio=denomOver>0 && diff>0?Math.log1p(diff)/denomOver:0;
      const color=colorToCss(mixColors(neutralWhite, redDeep, ratio));
      pushStop(gradientStops, percent, color);
    });
  }else{
    pushStop(gradientStops, 100, colorToCss(neutralWhite));
  }
  gradientStops.sort((a,b)=>a.percent-b.percent);
  const gradient=`linear-gradient(to top,
    ${gradientStops.map(stop=>`${stop.color} ${stop.percent}%`).join(',\n    ')})`;
  colorbar.style.background=gradient;
  if(slider?.lower){
    slider.lower.style.setProperty('--offset', `${lowerPct}%`);
    slider.lower.setAttribute('aria-valuemin', String(Math.round(domainMin)));
    slider.lower.setAttribute('aria-valuemax', String(Math.round(domainMax)));
    slider.lower.setAttribute('aria-valuenow', String(Math.round(state.dynamicLower)));
    slider.lower.setAttribute('aria-valuetext', `Lower threshold ${formatClampValue(state.dynamicLower)}`);
    slider.lower.dataset.value=formatClampValue(state.dynamicLower);
    slider.lower.title=`Lower threshold ${formatClampValue(state.dynamicLower)}`;
  }
  if(slider?.upper){
    slider.upper.style.setProperty('--offset', `${upperPct}%`);
    slider.upper.setAttribute('aria-valuemin', String(Math.round(domainMin)));
    slider.upper.setAttribute('aria-valuemax', String(Math.round(domainMax)));
    slider.upper.setAttribute('aria-valuenow', String(Math.round(state.dynamicUpper)));
    slider.upper.setAttribute('aria-valuetext', `Upper threshold ${formatClampValue(state.dynamicUpper)}`);
    slider.upper.dataset.value=formatClampValue(state.dynamicUpper);
    slider.upper.title=`Upper threshold ${formatClampValue(state.dynamicUpper)}`;
  }
}

function setImageDynamicRange(lower, upper, {emitRender=true, persist=false}={}){
  const state=scalingState.image;
  const bounds=enforceImageDynamicBounds(lower, upper);
  const changed=Math.abs(bounds.lower-state.dynamicLower)>SCALE_EPSILON || Math.abs(bounds.upper-state.dynamicUpper)>SCALE_EPSILON;
  state.dynamicLower=bounds.lower;
  state.dynamicUpper=bounds.upper;
  state.rangeInitialized=true;
  updateImageDynamicDisplay();
  if(changed && emitRender) renderImage();
  if(persist && !isInitializing) saveSettings();
  return changed;
}

function attachImageDynamicSlider(){
  const state=scalingState.image;
  const slider=state.slider;
  if(!slider || attachImageDynamicSlider._attached) return;
  const handles=[
    {el:slider.lower, type:'lower'},
    {el:slider.upper, type:'upper'}
  ];
  const pointerUpdate=(type, clientY)=>{
    if(!slider.rail) return;
    const rect=slider.rail.getBoundingClientRect();
    if(rect.height<=0) return;
    const ratio=clamp((rect.bottom-clientY)/rect.height, 0, 1);
    const domainMin=Number.isFinite(state.domainMin)?state.domainMin:IMAGE_MIN;
    const domainMax=Number.isFinite(state.domainMax)?state.domainMax:IMAGE_MAX;
    const mapped=domainMin + ratio*(domainMax-domainMin);
    const value=clamp(mapped, domainMin, domainMax);
    if(type==='lower'){
      const maxAllowed=state.dynamicUpper - MIN_DYNAMIC_SPAN;
      setImageDynamicRange(Math.min(value, maxAllowed), state.dynamicUpper, {emitRender:true});
    }else{
      const minAllowed=state.dynamicLower + MIN_DYNAMIC_SPAN;
      setImageDynamicRange(state.dynamicLower, Math.max(value, minAllowed), {emitRender:true});
    }
  };
  handles.forEach(({el,type})=>{
    if(!el) return;
    el.setAttribute('role','slider');
    el.setAttribute('tabindex','0');
    el.addEventListener('pointerdown', e=>{
      if(e.pointerType==='mouse' && e.button!==0) return;
      e.preventDefault();
      el.focus();
      slider.dragging={handle:type, pointerId:e.pointerId};
      if(el._tooltipTimeout){
        clearTimeout(el._tooltipTimeout);
        el._tooltipTimeout=null;
      }
      el.dataset.active='true';
      if(el.setPointerCapture) el.setPointerCapture(e.pointerId);
      pointerUpdate(type, e.clientY);
    });
    el.addEventListener('pointermove', e=>{
      const dragging=slider.dragging;
      if(!dragging || dragging.handle!==type || dragging.pointerId!==e.pointerId) return;
      pointerUpdate(type, e.clientY);
    });
    const finishDrag=e=>{
      const dragging=slider.dragging;
      if(!dragging || dragging.handle!==type || dragging.pointerId!==e.pointerId) return;
      slider.dragging=null;
      if(el._tooltipTimeout){
        clearTimeout(el._tooltipTimeout);
        el._tooltipTimeout=null;
      }
      el.removeAttribute('data-active');
      if(el.releasePointerCapture) el.releasePointerCapture(e.pointerId);
      if(!isInitializing) saveSettings();
    };
    el.addEventListener('pointerup', finishDrag);
    el.addEventListener('pointercancel', finishDrag);
    el.addEventListener('keydown', e=>{
      const step=e.shiftKey?15:5;
      let handled=false;
      if(e.key==='ArrowUp' || e.key==='ArrowRight'){
        if(type==='lower') setImageDynamicRange(state.dynamicLower + step, state.dynamicUpper, {emitRender:true, persist:true});
        else setImageDynamicRange(state.dynamicLower, state.dynamicUpper + step, {emitRender:true, persist:true});
        handled=true;
      }else if(e.key==='ArrowDown' || e.key==='ArrowLeft'){
        if(type==='lower') setImageDynamicRange(state.dynamicLower - step, state.dynamicUpper, {emitRender:true, persist:true});
        else setImageDynamicRange(state.dynamicLower, state.dynamicUpper - step, {emitRender:true, persist:true});
        handled=true;
      }else if(e.key==='Home'){
        if(type==='lower') setImageDynamicRange(IMAGE_MIN, state.dynamicUpper, {emitRender:true, persist:true});
        else setImageDynamicRange(state.dynamicLower, IMAGE_MAX, {emitRender:true, persist:true});
        handled=true;
      }else if(e.key==='End'){
        if(type==='lower') setImageDynamicRange(state.dynamicUpper - MIN_DYNAMIC_SPAN, state.dynamicUpper, {emitRender:true, persist:true});
        else setImageDynamicRange(state.dynamicLower, state.dynamicLower + MIN_DYNAMIC_SPAN, {emitRender:true, persist:true});
        handled=true;
      }
      if(handled){
        e.preventDefault();
        el.dataset.active='true';
        clearTimeout(el._tooltipTimeout);
        el._tooltipTimeout=setTimeout(()=>{
          el.removeAttribute('data-active');
        }, 1200);
      }
    });
  });
  attachImageDynamicSlider._attached=true;
}

function updateFrequencyColorbarDisplay(stats, displayRange){
  const state=scalingState.freq;
  if(state.button){
    state.button.setAttribute('aria-pressed', String(state.logScale));
    state.button.title=state.logScale?'Disable log scale':'Enable log scale';
  }
  if(state.colorbar){
    state.colorbar.classList.toggle('colorBar--log', state.logScale);
  }
  const effectiveRange=displayRange ?? getDisplayRange('freq', stats || state.lastStats);
  const effectiveStats=stats || state.lastStats || effectiveRange || {};
  const minValue=Number.isFinite(effectiveStats?.min)?effectiveStats.min:effectiveRange?.min;
  const maxValue=Number.isFinite(effectiveStats?.max)?effectiveStats.max:effectiveRange?.max;
  if(state.labelMin){
    const label=formatLabel('freq', minValue ?? 0);
    state.labelMin.textContent=label;
    state.labelMin.title=`Magnitude min ${label}`;
  }
  if(state.labelMax){
    const label=formatLabel('freq', maxValue ?? 0);
    state.labelMax.textContent=label;
    state.labelMax.title=`Magnitude max ${label}`;
  }
}

function setFrequencyLogScale(enabled){
  const state=scalingState.freq;
  if(state.logScale===enabled) return;
  state.logScale=enabled;
  updateFrequencyColorbarDisplay(state.lastStats, getDisplayRange('freq', state.lastStats));
  renderFreq();
  saveSettings();
}

let brushSize=7;
let brushPower=Number(brushPowerInput.value)||32;
const BRUSH_POWER_DEFAULT=32;
const powerNormDefault=BRUSH_POWER_DEFAULT/255;
const intensityCalib=255;
const frequencyGamma=Math.log(0.1)/Math.log(powerNormDefault);
const frequencyMax=2;
const phaseGamma=Math.log(0.5)/Math.log(powerNormDefault);
const phaseMax=Math.PI/2;

let deltaIntensity=powerNormDefault*intensityCalib;
let deltaFrequency=2*Math.pow(powerNormDefault, frequencyGamma);
let deltaPhase=Math.PI/8;
let drawing=false, drawButton=0;
let activeCanvas=null;
let activeCanvasEl=null;
let lastMouse={x:0,y:0};
let hoverState={canvas:null,x:0,y:0,domain:null};
let refreshMode='draw';
let imgSyncScheduled=false, imgSyncHandle=null, imgNeedsSync=false;
let forwardInputRows=null;
let freqConjRows=null;
let freqInputRows=null;

let currentTheme = 'light';
let hasSeenHelp = false;
let isInitializing = true;

const STORAGE_KEY = 'fourier-vis-settings';
let phaseVisible=false;
function updatePhaseVisibility(){
  if(phaseVisible) tripleGroup.classList.remove('phase-hidden');
  else tripleGroup.classList.add('phase-hidden');
  phaseToggle.setAttribute('data-open', String(phaseVisible));
  phaseToggle.setAttribute('aria-pressed', String(phaseVisible));
  const label=phaseVisible?'Hide phase':'Show phase';
  phaseToggle.setAttribute('title', label);
  phaseToggle.setAttribute('aria-label', label);
  const live=document.getElementById('phaseToggleStatus');
  if(live) live.textContent='Phase panel '+(phaseVisible?'visible':'hidden');
  const resizeAll=()=>{
    sizeOverlayFor(canvImage, overImg);
    sizeOverlayFor(canvFreq, overFft);
    sizeOverlayFor(canvPhase, overPhase);
    if(hoverState.canvas) refreshOverlayPreview();
  };
  resizeAll();
  const onEnd=(e)=>{
    if(e.target.closest && !e.target.closest('#tripleGroup')) return;
    if(e.propertyName==='flex-basis' || e.propertyName==='max-width' || e.propertyName==='flex-grow'){
      resizeAll();
      tripleGroup.removeEventListener('transitionend', onEnd, true);
    }
  };
  tripleGroup.addEventListener('transitionend', onEnd, true);
  if(!phaseVisible){
    octxPhase.clearRect(0,0,overPhase.width,overPhase.height);
  }
  saveSettings();
}
if(phaseToggle){
  phaseToggle.addEventListener('click', ()=>{ phaseVisible=!phaseVisible; updatePhaseVisibility(); });
  updatePhaseVisibility();
}


const DEFAULT_SETTINGS = {
  brushSize: 7,
  brushPower: 32,
  refreshMode: 'draw',
  phaseVisible: false,
  canvasSize: 128,
  theme: 'light',
  hasSeenHelp: false,
  domainsCardWidth: null,
  scaling: {
    image: { dynamic: false, dynamicLower: IMAGE_MIN, dynamicUpper: IMAGE_MAX, rangeInitialized: false },
    freq: { logScale: true }
  }
};

function saveSettings() {
  // Don't save during initialization to avoid overwriting loaded settings
  if (isInitializing) return;
  
  const settings = {
    brushSize,
    brushPower,
    refreshMode,
    phaseVisible,
    canvasSize: W,
    theme: currentTheme,
    hasSeenHelp,
    domainsCardWidth: (domainsCard && domainsCard.style.width) ? domainsCard.style.width : null,
    scaling: {
      image: {
        dynamic: scalingState.image.dynamic,
        dynamicLower: scalingState.image.dynamicLower,
        dynamicUpper: scalingState.image.dynamicUpper,
        rangeInitialized: scalingState.image.rangeInitialized
      },
      freq: {
        logScale: scalingState.freq.logScale
      }
    }
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Could not save settings to localStorage:', e);
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      isInitializing = false;
      const merged = { ...DEFAULT_SETTINGS, ...settings };
      const savedScaling = settings.scaling || {};
      merged.scaling = {
        image: { ...DEFAULT_SETTINGS.scaling.image, ...(savedScaling.image || {}) },
        freq: { ...DEFAULT_SETTINGS.scaling.freq, ...(savedScaling.freq || {}) }
      };
      return merged;
    }
  } catch (e) {
    console.warn('Could not load settings from localStorage:', e);
  }
  isInitializing = false;
  return DEFAULT_SETTINGS;
}

// Theme functions removed - using universal theme-manager.js instead

function setTheme(theme) {
  // Delegate to universal theme manager
  if (window.themeManager) {
    window.themeManager.setTheme(theme);
  }
}

// Resize logic for Domains card
function applyDomainsWidth(px){
  if(!domainsCard) return;
  const wrap = document.querySelector('html.fourier-vis .wrap');
  const max = Math.min((wrap?.clientWidth || 1400) - 40, 1600);
  const min = 420;
  const clamped = Math.max(min, Math.min(max, px));
  domainsCard.style.width = clamped + 'px';
}

function startDomainsResize(startX){
  if(!domainsCard) return;
  const rect = domainsCard.getBoundingClientRect();
  const startWidth = rect.width;
  const onMove = (e)=>{
    const dx = startX - e.clientX; // dragging left increases dx
    applyDomainsWidth(startWidth + dx);
    // keep overlays sized
    sizeOverlayFor(canvImage, overImg);
    sizeOverlayFor(canvFreq, overFft);
    sizeOverlayFor(canvPhase, overPhase);
  };
  const onUp = ()=>{
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveSettings();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function toggleTheme(event) {
  // Delegate to universal theme manager
  if (window.themeManager) {
    window.themeManager.toggleTheme(event);
  }
}

function showWelcomeHelpIfFirstTime() {
  const shouldShowHelp = !hasSeenHelp; // Capture the state immediately
  if (shouldShowHelp) {
    setTimeout(() => {
      // Double-check the value hasn't changed
      if (!hasSeenHelp) {
        openHelp();
      }
    }, 800);
  }
}

function updateBrushPower(value){
  brushPower=clamp(value,0,255);
  brushPowerInput.value=String(Math.round(brushPower));
  const powerNorm=brushPower/255;
  
  // Display the normalized power value (0.0 to 1.0)
  brushPowerValue.textContent = powerNorm.toFixed(2);
  
  // Theme-aware brush power indicator styling with gradient intensity
  const intensity = Math.round(powerNorm * 100);
  brushPowerValue.style.removeProperty('background');
  brushPowerValue.style.removeProperty('color');
  brushPowerValue.setAttribute('data-intensity', intensity);
  
  // Add dynamic color gradient based on power level
  if (powerNorm > 0) {
    const hue = 180 + (powerNorm * 60); // From cyan (180) to yellow-green (240)
    const saturation = 70 + (powerNorm * 30); // 70% to 100% saturation
    const lightness = 50 + (powerNorm * 20); // 50% to 70% lightness
    brushPowerValue.style.background = `linear-gradient(135deg, 
      hsl(${hue}, ${saturation}%, ${lightness}%), 
      hsl(${hue + 20}, ${saturation + 10}%, ${lightness - 10}%))`;
    brushPowerValue.style.color = powerNorm > 0.5 ? '#000' : '#fff';
  }
  
  deltaIntensity=powerNorm*intensityCalib;
  deltaFrequency=Math.min(Math.pow(powerNorm, frequencyGamma)*frequencyMax, frequencyMax);
  deltaPhase=Math.min(Math.pow(powerNorm, phaseGamma)*phaseMax, phaseMax);
  const tooltip=`Power: ${powerNorm.toFixed(2)} | dI=${deltaIntensity.toFixed(1)}, dF=${deltaFrequency.toFixed(2)}, dPhase=${deltaPhase.toFixed(2)} rad`;
  brushPowerValue.setAttribute('title',tooltip);
  brushPowerValue.setAttribute('aria-label', tooltip);
  saveSettings();
}

const brushPowerTooltip = document.getElementById('brushPowerTooltip');

function updateSliderTooltip(value, inputElement, tooltip) {
  const normalizedValue = value / 255;
  tooltip.textContent = normalizedValue.toFixed(2);
  
  // Calculate tooltip position based on slider value
  const percent = (value - inputElement.min) / (inputElement.max - inputElement.min);
  const sliderWidth = inputElement.offsetWidth;
  const thumbWidth = 14; // Width of the slider thumb
  const offset = percent * (sliderWidth - thumbWidth) + (thumbWidth / 2);
  
  tooltip.style.left = offset + 'px';
}

attachSliderWithWheel(brushPowerInput, updateBrushPower);
updateBrushPower(brushPower);

// Add input event for real-time tooltip updates
brushPowerInput.addEventListener('input', (e) => {
  const value = Number(e.target.value);
  updateBrushPower(value);
  updateSliderTooltip(value, brushPowerInput, brushPowerTooltip);
});

// Show tooltip on mouse enter/focus
brushPowerInput.addEventListener('mouseenter', () => {
  updateSliderTooltip(Number(brushPowerInput.value), brushPowerInput, brushPowerTooltip);
  brushPowerTooltip.classList.add('show');
});

brushPowerInput.addEventListener('focus', () => {
  updateSliderTooltip(Number(brushPowerInput.value), brushPowerInput, brushPowerTooltip);
  brushPowerTooltip.classList.add('show');
});

// Hide tooltip on mouse leave/blur
brushPowerInput.addEventListener('mouseleave', () => {
  brushPowerTooltip.classList.remove('show');
});

brushPowerInput.addEventListener('blur', () => {
  brushPowerTooltip.classList.remove('show');
});

// Keep tooltip visible while dragging
brushPowerInput.addEventListener('mousedown', () => {
  brushPowerTooltip.classList.add('show');
});

brushPowerValue.addEventListener('wheel', e=>{
  e.preventDefault();
  const delta=e.deltaY<0?5:-5;
  const next=clamp(brushPower+delta,0,255);
  brushPowerInput.value=String(next);
  updateBrushPower(next);
  updateSliderTooltip(next, brushPowerInput, brushPowerTooltip);
});

function loadImageFile(file){
  const url=URL.createObjectURL(file);
  const image=new Image();
  image.crossOrigin='anonymous';
  image.onload=()=>{
    const offscreen=document.createElement('canvas');
    offscreen.width=W;
    offscreen.height=H;
    const offCtx=offscreen.getContext('2d');
    if(!offCtx){
  toast('Unable to process image.', {duration:2000});
      URL.revokeObjectURL(url);
      uploadInput.value='';
      return;
    }
    offCtx.imageSmoothingEnabled=true;
    offCtx.drawImage(image,0,0,W,H);
    const data=offCtx.getImageData(0,0,W,H).data;
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const idx=y*W+x;
        const base=idx*4;
        const r=data[base];
        const g=data[base+1];
        const b=data[base+2];
        const grayscale=0.2126*r+0.7152*g+0.0722*b;
        img[idx]=grayscale*IMAGE_MAX/255;
      }
    }
    renderImage();
    forwardFromImage();
  toast('Image uploaded and converted to grayscale.', {duration:1800});
    URL.revokeObjectURL(url);
    uploadInput.value='';
  };
  image.onerror=()=>{
  toast('Could not load image.', {duration:2000});
    URL.revokeObjectURL(url);
    uploadInput.value='';
  };
  image.src=url;
}

uploadBtn.addEventListener('click', ()=>uploadInput.click());
uploadInput.addEventListener('change', e=>{
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  loadImageFile(file);
});

function setRefreshMode(mode){
  refreshMode=mode;
  refreshToggle.dataset.mode=mode;
  refreshToggle.setAttribute('aria-pressed', mode==='draw');
  refreshModeLabel.textContent=mode==='draw'?'On Draw':'On Mouse Lift';
  if(mode==='draw'){
    if(imgNeedsSync) scheduleImageSync();
    if(freqNeedsSync) scheduleFrequencySync();
  }else{
    if(imgSyncHandle!==null){
      cancelAnimationFrame(imgSyncHandle);
      imgSyncHandle=null;
      imgSyncScheduled=false;
    }
    if(freqSyncHandle!==null){
      cancelAnimationFrame(freqSyncHandle);
      freqSyncHandle=null;
      freqSyncScheduled=false;
    }
    if(imgNeedsSync) flushImageSync();
    if(freqNeedsSync) flushFrequencySync();
  }
  saveSettings();
}

refreshToggle.addEventListener('click', ()=>{
  setRefreshMode(refreshMode==='draw'?'lift':'draw');
});

setRefreshMode(refreshMode);

function setCanvasSize(){
  canvImage.width=W; canvImage.height=H;
  canvFreq.width=W;  canvFreq.height=H;
  canvPhase.width=W; canvPhase.height=H;
  sizeOverlayFor(canvImage, overImg);
  sizeOverlayFor(canvFreq,  overFft);
  sizeOverlayFor(canvPhase, overPhase);
}
function sizeOverlayFor(base, overlay){
  const dpr=window.devicePixelRatio||1;
  const r=base.getBoundingClientRect();
  overlay.style.width=r.width+'px';
  overlay.style.height=r.height+'px';
  overlay.width=Math.max(1,Math.round(r.width*dpr));
  overlay.height=Math.max(1,Math.round(r.height*dpr));
  const ctx=overlay.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled=false;
}


function clearToBlack(){
  img.fill(IMAGE_MIN);
  const imageState=scalingState.image;
  imageState.lastStats={min:IMAGE_MIN, max:IMAGE_MIN};
  imageState.domainMin=IMAGE_MIN;
  imageState.domainMax=IMAGE_MAX;
}


function renderImage(){
  const state=scalingState.image;
  const stats=computeStats(img, IMAGE_MIN, IMAGE_MAX);
  state.lastStats=stats;
  const rawMin=Number.isFinite(stats.min)?stats.min:IMAGE_MIN;
  const rawMax=Number.isFinite(stats.max)?stats.max:IMAGE_MAX;
  const domainMin=Math.min(rawMin, IMAGE_MIN);
  const domainMax=Math.max(rawMax, IMAGE_MAX);
  state.domainMin=domainMin;
  state.domainMax=domainMax;
  if(state.dynamic){
    const bounds=enforceImageDynamicBounds(state.dynamicLower, state.dynamicUpper);
    state.dynamicLower=bounds.lower;
    state.dynamicUpper=bounds.upper;
  }
  const displayRange=getDisplayRange('image', stats);
  updateColorbarLabels('image', displayRange, stats);
  const outOfRange=domainHasOutOfRange('image', stats);
  handleRangeError('image', outOfRange, stats);
  const shouldHighlight=!state.dynamic && outOfRange;
  updateImageClampDecorations(shouldHighlight, stats);

  if(state.dynamic) updateImageDynamicDisplay();

  const lowerBound=displayRange.min;
  const upperBound=displayRange.max;
  const rangeSpan=Math.max(upperBound-lowerBound, SCALE_EPSILON);
  const id=ctxImg.createImageData(W,H);
  let p=0;

  const useDynamic=state.dynamic;
  const lowerThreshold=useDynamic?state.dynamicLower:IMAGE_MIN;
  const upperThreshold=useDynamic?state.dynamicUpper:IMAGE_MAX;
  const maxOverDiff=Math.max(domainMax-upperThreshold, 0);
  const maxUnderDiff=Math.max(lowerThreshold-domainMin, 0);
  const overshootDenom=maxOverDiff>0?Math.log1p(maxOverDiff):0;
  const undershootDenom=maxUnderDiff>0?Math.log1p(maxUnderDiff):0;
  const neutralWhite=[255,255,255];
  const overshootTarget=[255,32,32];
  const undershootTarget=[32,120,255];
  const minTint=0.08;

  for(let i=0;i<img.length;i++){
    const value=img[i];
    const norm=(value-lowerBound)/rangeSpan;
    const base=useDynamic
      ? clamp(Math.round(clamp(norm,0,1)*DISPLAY_MAX), IMAGE_MIN, IMAGE_MAX)
      : clamp(Math.round(value), IMAGE_MIN, IMAGE_MAX);
    let r=base;
    let g=base;
    let b=base;

    if(value>upperThreshold){
      const diff=value-upperThreshold;
      if(diff>0){
        const raw=overshootDenom>0?Math.log1p(diff)/overshootDenom:1;
        const strength=clamp(diff>0?Math.max(minTint, raw):0, 0, 1);
        const highlight=mixColors(neutralWhite, overshootTarget, strength);
        r=mixChannel(r, highlight[0], strength);
        g=mixChannel(g, highlight[1], strength);
        b=mixChannel(b, highlight[2], strength);
      }
    }else if(value<lowerThreshold){
      const diff=lowerThreshold-value;
      if(diff>0){
        const raw=undershootDenom>0?Math.log1p(diff)/undershootDenom:1;
        const strength=clamp(diff>0?Math.max(minTint, raw):0, 0, 1);
        const highlight=mixColors(neutralWhite, undershootTarget, strength);
        r=mixChannel(r, highlight[0], strength);
        g=mixChannel(g, highlight[1], strength);
        b=mixChannel(b, highlight[2], strength);
      }
    }

    id.data[p++]=r;
    id.data[p++]=g;
    id.data[p++]=b;
    id.data[p++]=255;
  }

  ctxImg.putImageData(id,0,0);
}
function renderFreq(){
  const state=scalingState.freq;
  const useLog=state.logScale;
  const source=useLog?magShiftedLog:magShiftedLinear;
  const stats=computeStats(source, useLog?FREQUENCY_FIXED_MIN:0, useLog?FREQUENCY_FIXED_MAX:1);
  state.lastStats=stats;

  const displayRange=getDisplayRange('freq', stats);
  updateFrequencyColorbarDisplay(stats, displayRange);

  const lowerBound=displayRange.min;
  const upperBound=displayRange.max;
  const span=Math.max(upperBound-lowerBound, SCALE_EPSILON);

  const id=ctxFft.createImageData(W,H);
  let p=0;
  for(let i=0;i<source.length;i++){
    const value=source[i];
    const norm=clamp((value-lowerBound)/span,0,1);
    const intensity=clamp(Math.round(norm*DISPLAY_MAX), 0, DISPLAY_MAX);
    id.data[p++]=intensity;
    id.data[p++]=intensity;
    id.data[p++]=intensity;
    id.data[p++]=255;
  }
  ctxFft.putImageData(id,0,0);
}

function renderPhase(){
  const id=ctxPhase.createImageData(W,H);
  const range=PHASE_MAX_RAD-PHASE_MIN_RAD || 1;
  // Need unshifted magnitude access aligned with phaseShiftedDisplay pixels: we use magLog (unshifted) so map indices via inverse shift logic.
  const hx=W>>1, hy=H>>1;
  let p=0;
  for(let sy=0; sy<H; sy++){
    for(let sx=0; sx<W; sx++){
      const ux=(sx+hx)&(W-1);
      const uy=(sy+hy)&(H-1);
      const baseIdx=uy*W+ux;
      const magVal=mag[baseIdx];
      let val=phaseShiftedDisplay[sy*W+sx];
      if(magVal===0) val=0; // mask undefined phase where magnitude is zero
      val=clamp(val, PHASE_MIN_RAD, PHASE_MAX_RAD);
      const norm=(val-PHASE_MIN_RAD)/range;
      const g=Math.round(norm*255);
      id.data[p++]=g; id.data[p++]=g; id.data[p++]=g; id.data[p++]=255;
    }
  }
  ctxPhase.putImageData(id,0,0);
}


function forwardFromImage(){
  imgNeedsSync=false;
  const freqRows=forwardFFT2D();
  const total=totalSize;
  for(let y=0;y<H;y++){
    const row=freqRows[y];
    for(let x=0;x<W;x++){
      const idx=y*W+x;
      const r=row[2*x];
      const ii=row[2*x+1];
      re[idx]=r;
      im[idx]=ii;
      const magnitude=Math.hypot(r,ii);
      mag[idx]=magnitude;
      const logVal=Math.min(LOG_DISPLAY_MAX, Math.log1p(magnitude/total));
      magLog[idx]=logVal;
  const phaseVal=Math.atan2(ii,r); // -π..π
  phase[idx]=phaseVal; // store canonical principal value
  phaseWrapped[idx]=wrapToTwoPi(phaseVal); // 0..2π for display
    }
  }
  magShiftedLog.set(fftshift2D(magLog,W,H));
  magShiftedLinear.set(fftshift2D(mag,W,H));
  renderFreq();
  phaseShiftedDisplay.set(fftshift2D(phaseWrapped,W,H));
  renderPhase();
}
function inverseFromFrequencyEdit(){
  freqNeedsSync=false;
  if(!freqInputRows || freqInputRows.length!==H || freqInputRows?.[0]?.length!==2*W){
    freqInputRows=new Array(H);
    for(let y=0;y<H;y++) freqInputRows[y]=new Float32Array(2*W);
  }
  const freqRows=freqInputRows;
  for(let y=0;y<H;y++){
    const row=freqRows[y];
    for(let x=0;x<W;x++){
      const idx=y*W+x;
      const amp=mag[idx];
      const ph=phase[idx];
      const real=amp*Math.cos(ph);
      const imag=amp*Math.sin(ph);
      row[2*x]=real;
      row[2*x+1]=imag;
      re[idx]=real;
      im[idx]=imag;
    }
  }
  const spatialRows=inverseFFT2D(freqRows);
  for(let y=0;y<H;y++){
    const row=spatialRows[y];
    for(let x=0;x<W;x++){
      const idx=y*W+x;
      img[idx]=row[2*x];
    }
  }
  renderImage();
  renderPhase();
}


function addCircleToArray(arr,cx,cy,r,delta,min,max){
  const R=Math.max(1,r|0), R2=R*R/2;
  const xmin=clamp((cx|0)-R,0,W-1), xmax=clamp((cx|0)+R,0,W-1);
  const ymin=clamp((cy|0)-R,0,H-1), ymax=clamp((cy|0)+R,0,H-1);
  for(let y=ymin;y<=ymax;y++){
    const dy=y-cy;
    for(let x=xmin;x<=xmax;x++){
      const dx=x-cx;
      if(dx*dx+dy*dy< R2){
        const idx=y*W+x;
        arr[idx]=clamp(arr[idx]+delta,min,max);
      }
    }
  }
}
function mirrorIndexShifted(x,y){
  return {x:(W-x)&(W-1), y:(H-y)&(H-1)};
}

function shiftedToUnshiftedIndex(x,y){
  const hx=W>>1, hy=H>>1;
  const ux=(x+hx)&(W-1);
  const uy=(y+hy)&(H-1);
  return uy*W+ux;
}

function adjustFrequencyShiftedLogValue(sx,sy,deltaLog){
  const idxShift=sy*W+sx;
  const current=magShiftedLog[idxShift];
  const next=clamp(current+deltaLog,0,LOG_DISPLAY_MAX);
  magShiftedLog[idxShift]=next;
  const idx=shiftedToUnshiftedIndex(sx,sy);
  magLog[idx]=next;
  mag[idx]=Math.max(0,Math.expm1(next)*totalSize);
  magShiftedLinear[idxShift]=mag[idx];
  const mirror=mirrorIndexShifted(sx,sy);
  if(mirror.x===sx && mirror.y===sy) return;
  const mirrorIdxShift=mirror.y*W+mirror.x;
  magShiftedLog[mirrorIdxShift]=next;
  const idxMirror=shiftedToUnshiftedIndex(mirror.x,mirror.y);
  magLog[idxMirror]=next;
  mag[idxMirror]=Math.max(0,Math.expm1(next)*totalSize);
  magShiftedLinear[mirrorIdxShift]=mag[idxMirror];
}

function brushFrequencyCircle(cx,cy,radius,deltaLog){
  const R=Math.max(1,radius|0), R2=R*R/2;
  const xmin=clamp((cx|0)-R,0,W-1), xmax=clamp((cx|0)+R,0,W-1);
  const ymin=clamp((cy|0)-R,0,H-1), ymax=clamp((cy|0)+R,0,H-1);
  for(let y=ymin;y<=ymax;y++){
    const dy=y-cy;
    for(let x=xmin;x<=xmax;x++){
      const dx=x-cx;
      if(dx*dx+dy*dy< R2){
        const mirror=mirrorIndexShifted(x,y);
        adjustFrequencyShiftedLogValue(x,y,deltaLog);
      }
    }
  }
}

function applyFrequencyBrushDelta(cx,cy,radius,deltaLog){
  brushFrequencyCircle(cx,cy,radius,deltaLog);
}

function adjustPhaseShiftedValue(sx,sy,delta){
  const idxShift=sy*W+sx;
  const idx=shiftedToUnshiftedIndex(sx,sy);
  let newPhase=phase[idx]+delta; // operate in -π..π space
  newPhase=wrapToPi(newPhase);   // keep canonical principal value
  phase[idx]=newPhase;
  const wrapped=wrapToTwoPi(newPhase);
  phaseWrapped[idx]=wrapped;
  phaseShiftedDisplay[idxShift]=wrapped;
  const mirror=mirrorIndexShifted(sx,sy);
  if(mirror.x===sx && mirror.y===sy) return;
  const idxMirror=shiftedToUnshiftedIndex(mirror.x,mirror.y);
  let mirrorPhase=-newPhase; // conjugate symmetry
  mirrorPhase=wrapToPi(mirrorPhase);
  phase[idxMirror]=mirrorPhase;
  const mirrorWrapped=wrapToTwoPi(mirrorPhase);
  phaseWrapped[idxMirror]=mirrorWrapped;
  phaseShiftedDisplay[mirror.y*W+mirror.x]=mirrorWrapped;
}

function brushPhaseCircle(cx,cy,radius,delta){
  const R=Math.max(1,radius|0), R2=R*R/2;
  const xmin=clamp((cx|0)-R,0,W-1), xmax=clamp((cx|0)+R,0,W-1);
  const ymin=clamp((cy|0)-R,0,H-1), ymax=clamp((cy|0)+R,0,H-1);
  for(let y=ymin;y<=ymax;y++){
    const dy=y-cy;
    for(let x=xmin;x<=xmax;x++){
      const dx=x-cx;
      if(dx*dx+dy*dy< R2){
        const mirror=mirrorIndexShifted(x,y);
        adjustPhaseShiftedValue(x,y,delta);
      }
    }
  }
}

function applyPhaseBrushDelta(cx,cy,radius,delta){
  brushPhaseCircle(cx,cy,radius,delta);
}

function scheduleImageSync(){
  imgNeedsSync=true;
  if(refreshMode!=='draw') return;
  if(imgSyncScheduled) return;
  imgSyncScheduled=true;
  imgSyncHandle=requestAnimationFrame(()=>{
    imgSyncScheduled=false;
    imgSyncHandle=null;
    if(!imgNeedsSync) return;
    imgNeedsSync=false;
    forwardFromImage();
  });
}

function flushImageSync(){
  if(imgSyncHandle!==null){
    cancelAnimationFrame(imgSyncHandle);
    imgSyncHandle=null;
    imgSyncScheduled=false;
  }
  if(!imgNeedsSync) return;
  imgNeedsSync=false;
  forwardFromImage();
}

function scheduleFrequencySync(){
  freqNeedsSync=true;
  if(refreshMode!=='draw') return;
  if(freqSyncScheduled) return;
  freqSyncScheduled=true;
  freqSyncHandle=requestAnimationFrame(()=>{
    freqSyncScheduled=false;
    freqSyncHandle=null;
    if(!freqNeedsSync) return;
    freqNeedsSync=false;
    inverseFromFrequencyEdit();
  });
}

function flushFrequencySync(){
  if(freqSyncHandle!==null){
    cancelAnimationFrame(freqSyncHandle);
    freqSyncHandle=null;
    freqSyncScheduled=false;
  }
  if(!freqNeedsSync) return;
  freqNeedsSync=false;
  inverseFromFrequencyEdit();
}


function drawOverlay(ctx, base, radius, x, y){
  const r=base.getBoundingClientRect();
  const cellW = r.width / W;
  const cellH = r.height / H;
  const R = Math.max(1, radius|0);
  const xmin=clamp((x|0)-R,0,W-1), xmax=clamp((x|0)+R,0,W-1);
  const ymin=clamp((y|0)-R,0,H-1), ymax=clamp((y|0)+R,0,H-1);


  ctx.clearRect(0,0,r.width,r.height);
  ctx.lineWidth=1;
  ctx.strokeStyle='rgba(210,214,230,.7)';
  ctx.beginPath();
  for(let yy=ymin; yy<=ymax; yy++){
    const dy=yy - y;
    for(let xx=xmin; xx<=xmax; xx++){
      const dx=xx - x;
      if(dx*dx + dy*dy < R*R/2){
        const sx = xx*cellW, sy = yy*cellH;
        ctx.strokeRect(Math.round(sx)+.5, Math.round(sy)+.5, Math.max(1,cellW-1), Math.max(1,cellH-1));
      }
    }
  }
  ctx.stroke();
}


function canvasToLocalPos(canvas,e){
  const rect=canvas.getBoundingClientRect();
  const sx=canvas.width/rect.width, sy=canvas.height/rect.height;
  var obj =  {x:(e.clientX-rect.left)*sx, y:(e.clientY-rect.top)*sy};
  obj.x=clamp(Math.floor(obj.x),0,canvas.width-1);
  obj.y=clamp(Math.floor(obj.y),0,canvas.height-1);
  return obj;
}

function handlePointerDown(canvas,e,domain){
  e.preventDefault();
  drawing=true; drawButton=e.button; activeCanvas=domain; activeCanvasEl=canvas;
  const {x,y}=canvasToLocalPos(canvas,e); lastMouse={x,y};
  hoverState={canvas,x,y,domain};
  refreshOverlayPreview();
  paintAt(x,y,domain,drawButton);
}

function clearHoverState(){
  hoverState={canvas:null,x:0,y:0,domain:null};
  octxImg.clearRect(0,0,overImg.width,overImg.height);
  octxFft.clearRect(0,0,overFft.width,overFft.height);
  octxPhase.clearRect(0,0,overPhase.width,overPhase.height);
}

function refreshOverlayPreview(){
  if(!hoverState.canvas) return;
  const {canvas,domain,x,y}=hoverState;
  let ctx, radius;
  if(domain==='image'){ ctx=octxImg; radius=brushSize; }
  else if(domain==='freq'){ ctx=octxFft; radius=brushSize; }
  else { ctx=octxPhase; radius=brushSize; }
  drawOverlay(ctx, canvas, radius, x, y);
}

function handlePointerMove(e){
  const t=e.target;
  if(t===canvImage || t===canvFreq || t===canvPhase){
    const {x,y}=canvasToLocalPos(t,e);
    const domain=t===canvImage?'image':(t===canvFreq?'freq':'phase');
    hoverState={canvas:t,x,y,domain};
    refreshOverlayPreview();
  }else{
    clearHoverState();
  }

  if(!drawing || !activeCanvas) return;
  const base=activeCanvasEl;
  const {x,y}=canvasToLocalPos(base,e);
  const dx=x-lastMouse.x, dy=y-lastMouse.y;
  const steps=Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for(let s=1;s<=steps;s++){
    const px=lastMouse.x+dx*s/steps, py=lastMouse.y+dy*s/steps;
    paintAt(px,py,activeCanvas,drawButton);
  }
  if(drawing && activeCanvas){
    hoverState={canvas:base,x,y,domain:activeCanvas};
    refreshOverlayPreview();
  }
  lastMouse={x,y};
}
function handlePointerUp(){
  if(!activeCanvas) return;
  drawing=false;
  if(activeCanvas==='image') flushImageSync();
  else flushFrequencySync();
  activeCanvas=null; activeCanvasEl=null;
}


function paintAt(x,y,domain,btn){
  if(domain==='image'){
    const delta=(btn===0)?deltaIntensity:-deltaIntensity;
    addCircleToArray(img,x,y,brushSize,delta/brushSize,IMAGE_MIN,IMAGE_MAX);
    renderImage();
    if(refreshMode==='draw') scheduleImageSync();
    else imgNeedsSync=true;
  }else if(domain==='freq'){
    const deltaLog=(btn===0)?deltaFrequency:-deltaFrequency;
    applyFrequencyBrushDelta(x,y,brushSize,deltaLog/brushSize);
    renderFreq();
    scheduleFrequencySync();
  }else{
    const deltaAngle=(btn===0)?deltaPhase:-deltaPhase;
    applyPhaseBrushDelta(x,y,brushSize, deltaAngle/brushSize);
    renderPhase();
    scheduleFrequencySync();
  }
}


function handleWheel(canvas,domain,e){
  e.preventDefault();
  const delta=Math.sign(e.deltaY);
  brushSize=clamp(brushSize - delta,1,120);
  brushSizeLabel.textContent=brushSize;
  const {x,y}=canvasToLocalPos(canvas,e);
  hoverState={canvas,x,y,domain};
  refreshOverlayPreview();
  saveSettings();
}


function wireCanvas(canvas,overlay,domain){
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('mousedown', e=>handlePointerDown(canvas,e,domain));
  canvas.addEventListener('wheel', e=>handleWheel(canvas,domain,e), {passive:false});
  canvas.addEventListener('mouseenter', e=>{
    const {x,y}=canvasToLocalPos(canvas,e);
    hoverState={canvas,x,y,domain};
    refreshOverlayPreview();
  });
  canvas.addEventListener('mouseleave', ()=>{clearHoverState();});
}
wireCanvas(canvImage, overImg, 'image');
wireCanvas(canvFreq,  overFft, 'freq');
wireCanvas(canvPhase, overPhase, 'phase');
window.addEventListener('mousemove', handlePointerMove, {passive:false});
window.addEventListener('mouseup', handlePointerUp);

let lastValidSize=W;

function triggerDimensionError(){
  sizeInput.classList.add('input-error');
  sizeInput.addEventListener('animationend', ()=>sizeInput.classList.remove('input-error'), {once:true});
  toast('Image size must be a power of two (32, 64, 128, ...).', {duration:2200, type:'error'});
}

function applyDimensions(size){
  if(size===W) return; // square
  W=size;
  H=size;
  totalSize=W*H;
  lastValidSize=W;
  img=new Float64Array(W*H);
  re =new Float64Array(W*H);
  im =new Float64Array(W*H);
  mag=new Float64Array(W*H);
  magLog=new Float64Array(W*H);
  phase=new Float64Array(W*H);
  magShiftedLog=new Float64Array(W*H);
  magShiftedLinear=new Float64Array(W*H);
  phaseWrapped=new Float64Array(W*H);
  phaseShiftedDisplay=new Float64Array(W*H);
  freqNeedsSync=false;
  imgNeedsSync=false;
  if(freqSyncHandle!==null){ cancelAnimationFrame(freqSyncHandle); freqSyncHandle=null; }
  freqSyncScheduled=false;
  if(imgSyncHandle!==null){ cancelAnimationFrame(imgSyncHandle); imgSyncHandle=null; }
  imgSyncScheduled=false;
  disposeFft();
  forwardInputRows=null;
  freqConjRows=null;
  freqInputRows=null;
  setCanvasSize();
  clearToBlack();
  renderImage();
  forwardFromImage();
  brushSizeLabel.textContent=brushSize;
  if(sizeInput) sizeInput.value=String(W);
  // preserve existing phaseVisible state when resizing
  updatePhaseVisibility();
  clearHoverState();
  saveSettings();
}

function handleDimensionChange(){
  const newSize=parseInt(sizeInput.value,10);
  if(!Number.isFinite(newSize) || !isPow2(newSize)){
    triggerDimensionError();
    sizeInput.value=String(lastValidSize);
    return;
  }
  lastValidSize=newSize;
  applyDimensions(newSize);
}

sizeInput.addEventListener('change', handleDimensionChange);
sizeInput.addEventListener('input', ()=>sizeInput.classList.remove('input-error'));
let lastFocus=null;
function openHelp(){
  if(!helpModal) return;
  lastFocus=document.activeElement;
  helpModal.dataset.open='true';
  helpBtn?.setAttribute('aria-expanded','true');
  setTimeout(()=>{helpClose?.focus();},100);
  
  if(!hasSeenHelp) {
    hasSeenHelp = true;
    saveSettings();
  }
}
function closeHelp(){
  if(!helpModal) return;
  
  // Ensure hasSeenHelp is set when closing help
  if(!hasSeenHelp) {
    hasSeenHelp = true;
    saveSettings();
  }
  
  helpModal.dataset.open='false';
  helpBtn?.setAttribute('aria-expanded','false');
  setTimeout(()=>{
    if(lastFocus && typeof lastFocus.focus==='function') lastFocus.focus();
  }, 300);
}
helpBtn?.addEventListener('click', ()=>openHelp());
helpClose?.addEventListener('click', (e)=>{
  e.preventDefault();
  e.stopPropagation();
  closeHelp();
});
helpModal?.addEventListener('click', e=>{ if(e.target===helpModal) closeHelp(); });
window.addEventListener('keydown', e=>{ if(e.key==='Escape' && helpModal?.dataset.open==='true') { e.preventDefault(); closeHelp(); } });

window.addEventListener('resize', ()=>{ sizeOverlayFor(canvImage,overImg); sizeOverlayFor(canvFreq,overFft); sizeOverlayFor(canvPhase,overPhase); });
window.addEventListener('beforeunload', disposeFft);
window.addEventListener('unload', disposeFft);

(function init(){
  isInitializing = true; // Prevent saving during initialization

  const settings = loadSettings();
  isInitializing = true;

  brushSize = settings.brushSize;
  phaseVisible = settings.phaseVisible;
  hasSeenHelp = settings.hasSeenHelp;

  applyScalingSettings(settings.scaling);
  attachScalingControls();

  setTheme(settings.theme || 'light');
  updateBrushPower(settings.brushPower);
  setRefreshMode(settings.refreshMode);
  // Apply saved Domains card width if present
  if (settings.domainsCardWidth) {
    domainsCard.style.width = settings.domainsCardWidth;
  }
  
  if (settings.canvasSize !== W) {
    applyDimensions(settings.canvasSize);
  } else {
    setCanvasSize();
    clearToBlack();
    renderImage();
    forwardFromImage();
  }
  
  updatePhaseVisibility();
  brushSizeLabel.textContent=brushSize;
  // Bind resize handle interactions
  if(domainsResizeHandle){
    domainsResizeHandle.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      startDomainsResize(e.clientX);
    });
    domainsResizeHandle.addEventListener('keydown', (e)=>{
      // Keyboard resize for accessibility
      const step = (e.shiftKey?40:20);
      const rect = domainsCard.getBoundingClientRect();
      if(e.key==='ArrowLeft'){
        applyDomainsWidth(rect.width + step);
        sizeOverlayFor(canvImage, overImg);
        sizeOverlayFor(canvFreq, overFft);
        sizeOverlayFor(canvPhase, overPhase);
        saveSettings();
        e.preventDefault();
      } else if(e.key==='ArrowRight'){
        applyDomainsWidth(rect.width - step);
        sizeOverlayFor(canvImage, overImg);
        sizeOverlayFor(canvFreq, overFft);
        sizeOverlayFor(canvPhase, overPhase);
        saveSettings();
        e.preventDefault();
      }
    });
  }
  
  const themeToggle = document.getElementById('themeToggle');
  // Theme toggle is handled by the universal theme-manager.js
  showWelcomeHelpIfFirstTime();

  isInitializing = false;

})();
