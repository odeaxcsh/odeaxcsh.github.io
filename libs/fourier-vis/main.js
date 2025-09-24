import WebFFT from 'https://cdn.jsdelivr.net/npm/webfft@1.0.3/lib/main.js';
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const nextPow2=n=>1<<Math.max(3,Math.ceil(Math.log2(Math.max(8,n|0))));
const isPow2=n=>n>0 && (n & (n-1))===0;
const to255=v=>Math.round(clamp(v,0,225)*255/225);
const LOG_DRAW_FULL=Math.log1p(225);
const LOG_DISPLAY_MAX=LOG_DRAW_FULL;
const TWO_PI=Math.PI*2;
const PHASE_MIN_RAD=0;
const PHASE_MAX_RAD=TWO_PI;
function toast(msg, ms=1500){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),ms);
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
let phaseWrapped=new Float64Array(W*H);
let phaseShiftedDisplay=new Float64Array(W*H);
let freqSyncScheduled=false, freqSyncHandle=null, freqNeedsSync=false;

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
  domainsCardWidth: null
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
    domainsCardWidth: (domainsCard && domainsCard.style.width) ? domainsCard.style.width : null
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
      return { ...DEFAULT_SETTINGS, ...settings };
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
      toast('Unable to process image.', 2000);
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
        img[idx]=grayscale*225/255;
      }
    }
    renderImage();
    forwardFromImage();
    toast('Image uploaded and converted to grayscale.', 1800);
    URL.revokeObjectURL(url);
    uploadInput.value='';
  };
  image.onerror=()=>{
    toast('Could not load image.', 2000);
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


function clearToBlack(){ img.fill(0); }


function renderImage(){
  const id=ctxImg.createImageData(W,H);
  let p=0;
  for(let i=0;i<img.length;i++){
    const v=to255(img[i]);
    id.data[p++]=v; id.data[p++]=v; id.data[p++]=v; id.data[p++]=255;
  }
  ctxImg.putImageData(id,0,0);
}
function renderFreq(){
  const id=ctxFft.createImageData(W,H);
  const inv=LOG_DISPLAY_MAX>0?1/LOG_DISPLAY_MAX:0;
  let p=0;
  for(let i=0;i<magShiftedLog.length;i++){
    const norm=clamp(magShiftedLog[i]*inv,0,1);
    const v=to255(norm*225);
    id.data[p++]=v; id.data[p++]=v; id.data[p++]=v; id.data[p++]=255;
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
      img[idx]=clamp(row[2*x],0,225);
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
  return {x:(W-x-1)&(W-1), y:(H-y-1)&(H-1)};
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
  const mirror=mirrorIndexShifted(sx,sy);
  if(mirror.x===sx && mirror.y===sy) return;
  const mirrorIdxShift=mirror.y*W+mirror.x;
  magShiftedLog[mirrorIdxShift]=next;
  const idxMirror=shiftedToUnshiftedIndex(mirror.x,mirror.y);
  magLog[idxMirror]=next;
  mag[idxMirror]=Math.max(0,Math.expm1(next)*totalSize);
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
    addCircleToArray(img,x,y,brushSize,delta/brushSize,0,225);
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
  toast('Image size must be a power of two (32, 64, 128, ...).', 2200);
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
  
  brushSize = settings.brushSize;
  phaseVisible = settings.phaseVisible;
  hasSeenHelp = settings.hasSeenHelp;
  
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

})();
