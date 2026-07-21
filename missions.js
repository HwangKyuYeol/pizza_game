window.PizzaMissions = (() => {
  const templates = [
    {type:"collect", key:"onion", target:6, reward:50, text:"양파 6개 받기"},
    {type:"collect", key:"sweet", target:6, reward:50, text:"고구마 6개 받기"},
    {type:"combo", target:10, reward:50, text:"10콤보 달성하기"}
  ];
  function create(){
    const mission = {...templates[Math.floor(Math.random()*templates.length)]};
    mission.progress = 0;
    mission.completed = false;
    return mission;
  }
  function update(mission, event, payload){
    if(!mission || mission.completed) return false;
    if(mission.type === "collect" && event === "collect" && payload.type === mission.key) mission.progress++;
    if(mission.type === "combo" && event === "combo") mission.progress = Math.max(mission.progress, payload.combo);
    if(mission.progress >= mission.target){
      mission.completed = true;
      return true;
    }
    return false;
  }
  return {create, update};
})();