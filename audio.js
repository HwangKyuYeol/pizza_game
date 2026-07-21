window.PizzaAudio = (() => {
  let ctx = null;
  let enabled = true;
  function unlock(){
    if(!ctx){
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if(AudioContextClass) ctx = new AudioContextClass();
    }
    if(ctx && ctx.state === "suspended") ctx.resume().catch(()=>{});
  }
  function beep(freq, duration=.06, type="sine", volume=.035){
    if(!enabled || !ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = freq;
    oscillator.type = type;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }
  return {
    unlock,
    beep,
    toggle(){ enabled = !enabled; return enabled; },
    isEnabled(){ return enabled; }
  };
})();