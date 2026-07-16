(()=>{"use strict";
const $=id=>document.getElementById(id),app=$("app"),cv=$("cv"),ctx=cv.getContext("2d"),hud=$("hud"),start=$("start"),count=$("count"),countText=$("countText"),pauseScreen=$("pauseScreen"),result=$("result"),hearts=$("hearts"),scoreEl=$("score"),timeEl=$("time"),bar=$("bar"),fever=$("fever"),danger=$("danger");
const imgs={},src={onion:"./assets/images/onion.png",sauce:"./assets/images/sauce.png",cheese:"./assets/images/cheese.png",sweet:"./assets/images/sweetpotato.png",dough:"./assets/images/dough.png",bomb:"./assets/images/bomb.png"},goods=["onion","sauce","cheese","sweet","dough"];
for(const k in src){imgs[k]=new Image();imgs[k].src=src[k]}
let W,H,D=1,state="ready",score=0,lives=3,elapsed=0,left=30,last=0,spawn=0,combo=0,player,items=[],fx=[],parts=[],pointer=null,soundOn=true,audio=null,token="",lastBombHit=-999;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rnd=(a,b)=>Math.random()*(b-a)+a,wait=ms=>new Promise(r=>setTimeout(r,ms));
function resize(){D=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*D;cv.height=H*D;ctx.setTransform(D,0,0,D,0,0);const w=clamp(W*.235,92,135);player=player||{x:W/2,tx:W/2};Object.assign(player,{w,h:w*.62,y:H-w*.62-Math.max(22,H*.03)});player.x=clamp(player.x,w/2,W-w/2);player.tx=player.x}
function hudUpdate(){scoreEl.textContent=score;timeEl.textContent=Math.max(0,Math.ceil(left));bar.style.width=clamp(score/200*100,0,100)+"%";hearts.innerHTML="";for(let i=0;i<3;i++){const s=document.createElement("span");s.className="heart"+(i>=lives?" off":"");s.textContent="❤️";hearts.appendChild(s)}}
function reset(){score=0;lives=3;elapsed=0;left=30;spawn=0;combo=0;lastBombHit=-999;items=[];fx=[];parts=[];player.x=player.tx=W/2;token="";app.classList.remove("edge","shake");fever.classList.add("hidden");danger.classList.add("hidden");hudUpdate()}
function unlock(){if(!audio){const A=window.AudioContext||window.webkitAudioContext;if(A)audio=new A}if(audio&&audio.state==="suspended")audio.resume().catch(()=>{})}
function beep(f,d=.06,t="sine",v=.035){if(!soundOn||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;o.type=t;g.gain.setValueAtTime(v,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}
async function begin(){if(state==="playing"||state==="countdown")return;unlock();reset();start.classList.add("hidden");result.classList.add("hidden");pauseScreen.classList.add("hidden");hud.classList.remove("hidden");count.classList.remove("hidden");state="countdown";for(const x of ["3","2","1","START!"]){countText.textContent=x;beep(x==="START!"?680:430,.08,"square",.04);await wait(x==="START!"?500:700)}count.classList.add("hidden");state="playing";last=performance.now();requestAnimationFrame(loop)}
function profile(){
if(elapsed<5)return{gap:rnd(.23,.30),bomb:.24,min:340,max:470,scale:.97,double:.05};
if(elapsed<10)return{gap:rnd(.19,.26),bomb:.30,min:400,max:540,scale:.93,double:.09};
if(elapsed<15)return{gap:rnd(.16,.22),bomb:.36,min:470,max:620,scale:.89,double:.14};
if(elapsed<20)return{gap:rnd(.13,.19),bomb:.42,min:550,max:710,scale:.85,double:.20};
if(elapsed<25)return{gap:rnd(.11,.16),bomb:.48,min:640,max:820,scale:.81,double:.28};
return{gap:rnd(.09,.14),bomb:.55,min:740,max:960,scale:.77,double:.38}
}
function createDrop(p,forceBomb=false,offset=0){
const bomb=forceBomb||Math.random()<p.bomb;
const type=bomb?"bomb":goods[Math.floor(Math.random()*goods.length)];
const base=(W<600?rnd(48,66):rnd(56,76))*p.scale;
const s=base*(bomb?1.02:1);
const margin=s*.65;
let x=rnd(margin,W-margin)+offset;
x=clamp(x,margin,W-margin);
items.push({
type,x,y:-s-rnd(0,45),s,
spd:rnd(p.min,p.max)*(bomb?rnd(1.02,1.13):1),
r:rnd(-.35,.35),
spin:bomb?rnd(-4.2,4.2):rnd(-2.8,2.8),
wave:rnd(0,6.28),
ws:bomb?rnd(6.5,10.5):rnd(2.5,5.8),
amp:bomb?rnd(32,58):rnd(7,14)
});
}
function spawnItem(){
const p=profile();
createDrop(p);
if(Math.random()<p.double){
const forceBomb=Math.random()<.58;
createDrop(p,forceBomb,rnd(-W*.22,W*.22));
}
spawn=p.gap
}
function effect(x,y,text,bad=false,size=1){fx.push({x,y,text,bad,size,life:.85,max:.85})}
function burst(x,y,bad){for(let i=0;i<(bad?18:12);i++)parts.push({x,y,vx:rnd(-150,150),vy:rnd(-210,-60),g:rnd(300,460),s:rnd(3,7),life:rnd(.45,.8),max:.8,bad})}
function shake(){app.classList.remove("shake");void app.offsetWidth;app.classList.add("shake");setTimeout(()=>app.classList.remove("shake"),320)}
function collect(it,x){if(it.type==="bomb"){if(elapsed-lastBombHit<.38)return;lastBombHit=elapsed;score=Math.max(0,score-10);lives--;combo=0;effect(x,player.y-10,"-10",true);burst(x,player.y,true);shake();if(navigator.vibrate)navigator.vibrate([80,35,100]);beep(90,.17,"sawtooth",.08);hudUpdate();if(lives<=0)finish(false,"life")}else{score+=10;combo++;effect(x,player.y-10,"+10");burst(x,player.y,false);beep(520+Math.min(combo,10)*20);if(combo===3)effect(W/2,H*.42,"GOOD!",false,1);if(combo===5)effect(W/2,H*.42,"GREAT!",false,1.05);if(combo===10)effect(W/2,H*.42,"PERFECT!!",false,1.15);if(score>=200)finish(true,"score")}}
function loop(now){if(state!=="playing")return;const dt=Math.min((now-last)/1000,.034);last=now;elapsed+=dt;left=30-elapsed;if(left<=0){left=0;hudUpdate();finish(score>=200,"time");return}const bombRush=left<=12,dangerNow=left<=12&&left>8,f=left<=8;danger.classList.toggle("hidden",!dangerNow);fever.classList.toggle("hidden",!f);app.classList.toggle("edge",bombRush);player.x+=(player.tx-player.x)*Math.min(1,dt*(W<700?22:14));spawn-=dt;if(spawn<=0)spawnItem();
for(let i=items.length-1;i>=0;i--){const it=items[i];it.y+=it.spd*dt;it.r+=it.spin*dt;it.wave+=it.ws*dt;const x=it.x+Math.sin(it.wave)*it.amp,hitPad=it.type==="bomb"?.38:.27,hit=Math.abs(x-player.x)<player.w*.46+it.s*hitPad&&it.y+it.s*.42>=player.y&&it.y-it.s*.36<=player.y+player.h*.8;if(hit){collect(it,x);items.splice(i,1)}else if(it.y-it.s>H){if(it.type!=="bomb")combo=0;items.splice(i,1)}}
for(let i=fx.length-1;i>=0;i--){fx[i].life-=dt;fx[i].y-=55*dt;if(fx[i].life<=0)fx.splice(i,1)}for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.life<=0)parts.splice(i,1)}draw();hudUpdate();requestAnimationFrame(loop)}
function round(x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.rect(x,y,w,h))}
function draw(){ctx.clearRect(0,0,W,H);for(const it of items){const x=it.x+Math.sin(it.wave)*it.amp;ctx.save();ctx.translate(x,it.y);ctx.rotate(it.r);ctx.drawImage(imgs[it.type],-it.s/2,-it.s/2,it.s,it.s);ctx.restore()}ctx.save();ctx.translate(player.x,player.y);ctx.shadowColor="#0006";ctx.shadowBlur=16;ctx.shadowOffsetY=8;round(-player.w/2,0,player.w,player.h,17);ctx.fillStyle="#d71920";ctx.fill();ctx.shadowColor="transparent";ctx.strokeStyle="#fff8e6";ctx.lineWidth=4;ctx.stroke();ctx.fillStyle="#fff8e6";ctx.font="900 "+Math.max(17,player.w*.16)+"px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("PIZZA",0,player.h*.48);ctx.restore();
for(const p of parts){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.bad?"#222":"#ffe044";ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,6.28);ctx.fill();ctx.restore()}for(const e of fx){ctx.save();ctx.globalAlpha=clamp(e.life/e.max,0,1);ctx.translate(e.x,e.y);ctx.scale(e.size,e.size);ctx.font="900 30px Arial";ctx.textAlign="center";ctx.lineWidth=6;ctx.strokeStyle=e.bad?"#fff":"#d71920";ctx.fillStyle=e.bad?"#171717":"#ffe448";ctx.strokeText(e.text,0,0);ctx.fillText(e.text,0,0);ctx.restore()}}
function finish(ok,why){if(state!=="playing")return;state="finished";app.classList.remove("edge");fever.classList.add("hidden");danger.classList.add("hidden");$("resultTitle").textContent=ok?"피자 완성!":why==="life"?"하트를 모두 잃었어요!":"아쉽습니다!";$("resultMsg").innerHTML=ok?`축하합니다!<br><strong>${score}점</strong>을 달성했어요.`:`최종 점수 <strong>${score}점</strong><br>다시 도전해 200점을 채워보세요.`;$("pizza").classList.toggle("hidden",!ok);$("codeBox").classList.toggle("hidden",!ok);$("save").classList.toggle("hidden",!ok);if(ok){const d=new Date(),dp=String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");token=`SMP-${dp}-${Math.floor(10000+Math.random()*90000)}`;$("code").textContent=token;[523,659,784,1046].forEach((n,i)=>setTimeout(()=>beep(n,.14,"sine",.045),i*115))}else beep(150,.22,"triangle",.05);setTimeout(()=>result.classList.remove("hidden"),220)}
function save(){if(!token)return;const c=document.createElement("canvas"),x=c.getContext("2d");c.width=1080;c.height=1350;const g=x.createLinearGradient(0,0,0,1350);g.addColorStop(0,"#d71920");g.addColorStop(1,"#8e0f14");x.fillStyle=g;x.fillRect(0,0,1080,1350);x.fillStyle="#fff8e8";x.roundRect(90,115,900,1120,48);x.fill();x.textAlign="center";x.fillStyle="#d71920";x.font="900 58px Arial";x.fillText("선명희피자",540,250);x.font="900 80px Arial";x.fillText("피자 완성!",540,390);x.font="120px Arial";x.fillText("🍕",540,550);x.fillStyle="#2d201c";x.font="900 44px Arial";x.fillText(`최종 점수 ${score}점`,540,700);x.fillStyle="#fff";x.roundRect(180,770,720,210,35);x.fill();x.strokeStyle="#d71920";x.lineWidth=8;x.setLineDash([18,12]);x.stroke();x.setLineDash([]);x.fillStyle="#7a645c";x.font="900 26px Arial";x.fillText("SUCCESS CODE",540,840);x.fillStyle="#d71920";x.font="900 51px Arial";x.fillText(token,540,920);x.fillStyle="#5b4942";x.font="700 29px Arial";x.fillText("캡처 후 댓글 또는 DM으로 보내주세요.",540,1090);const a=document.createElement("a");a.download=`선명희피자_성공_${token}.png`;a.href=c.toDataURL("image/png");a.click()}
function move(x){if(state==="playing")player.tx=clamp(x,player.w/2,W-player.w/2)}
cv.addEventListener("pointerdown",e=>{pointer=e.pointerId;cv.setPointerCapture?.(e.pointerId);move(e.clientX)},{passive:true});cv.addEventListener("pointermove",e=>{if(pointer===null||pointer===e.pointerId)move(e.clientX)},{passive:true});cv.addEventListener("pointerup",e=>{if(e.pointerId===pointer)pointer=null},{passive:true});
$("startBtn").onclick=begin;$("retry").onclick=begin;$("pause").onclick=()=>{if(state==="playing"){state="paused";pauseScreen.classList.remove("hidden")}};$("resume").onclick=()=>{if(state==="paused"){pauseScreen.classList.add("hidden");state="playing";last=performance.now();requestAnimationFrame(loop)}};$("sound").onclick=()=>{soundOn=!soundOn;$("sound").textContent=soundOn?"🔊":"🔇";if(soundOn){unlock();beep(600)}};$("save").onclick=save;
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state==="playing")$("pause").click()});addEventListener("resize",resize);resize();hudUpdate();
})();
