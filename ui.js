window.PizzaUI = (() => {
  const $ = id => document.getElementById(id);
  const els = {
    app:$("app"),
    hud:$("hud"),
    hearts:$("hearts"),
    score:$("score"),
    time:$("time"),
    rank:$("rank"),
    progress:$("progress"),
    buildStage:$("buildStage"),
    missionText:$("missionText"),
    missionProgress:$("missionProgress"),
    bestScore:$("bestScore"),
    fever:$("feverBanner"),
    power:$("powerBanner"),
    start:$("startScreen"),
    result:$("resultScreen"),
    pause:$("pauseScreen"),
    countdown:$("countdownScreen"),
    countdownText:$("countdownText")
  };
  function getRank(score){
    if(score>=700) return "SSS";
    if(score>=600) return "SS";
    if(score>=500) return "S";
    if(score>=400) return "A";
    if(score>=300) return "B";
    return "C";
  }
  function stage(score){
    if(score<100) return "🍞 도우 준비";
    if(score<200) return "🍅 소스 완성";
    if(score<300) return "🧀 치즈 듬뿍";
    if(score<400) return "🥩 토핑 추가";
    if(score<500) return "🔥 오븐에서 굽는 중";
    return "🍕 피자 완성!";
  }
  function update(game){
    els.score.textContent = game.score;
    els.time.textContent = Math.max(0,Math.ceil(game.remaining));
    els.rank.textContent = getRank(game.score);
    els.progress.style.width = Math.min(100,game.score/500*100)+"%";
    els.buildStage.textContent = stage(game.score);
    els.hearts.innerHTML = "";
    for(let i=0;i<3;i++){
      const heart=document.createElement("span");
      heart.textContent="❤️";
      heart.className="heart"+(i>=game.lives?" off":"");
      els.hearts.appendChild(heart);
    }
    els.missionText.textContent = game.mission.text;
    els.missionProgress.textContent = `${Math.min(game.mission.progress,game.mission.target)} / ${game.mission.target}`;
    els.fever.classList.toggle("hidden", game.remaining>8);
  }
  return {els,getRank,stage,update};
})();