window.PizzaItems = (() => {
  const good = ["onion","sauce","cheese","sweet","dough","potato"];
  function profile(elapsed){
    if(elapsed < 8) return {gap:[.22,.30], bomb:.22, min:330, max:470};
    if(elapsed < 16) return {gap:[.17,.24], bomb:.30, min:420, max:590};
    if(elapsed < 22) return {gap:[.13,.19], bomb:.38, min:520, max:700};
    return {gap:[.10,.15], bomb:.46, min:620, max:860};
  }
  function make(width, elapsed, forceType=null){
    const p = profile(elapsed);
    let type = forceType;
    if(!type) type = Math.random() < p.bomb ? "bomb" : good[Math.floor(Math.random()*good.length)];
    const size = width < 600 ? 50 + Math.random()*18 : 58 + Math.random()*20;
    return {
      type,
      x: size + Math.random()*(width-size*2),
      y: -size-Math.random()*30,
      size,
      speed: p.min + Math.random()*(p.max-p.min),
      rotation: 0,
      spin: (Math.random()-.5)*(type==="bomb"?8:6),
      wave: Math.random()*Math.PI*2,
      waveSpeed: type==="bomb" ? 8 : 4,
      amp: type==="bomb" ? 38 : 10
    };
  }
  return {good, profile, make};
})();