(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  const UI = window.PizzaUI;

  const images = {};
  const paths = {
    onion: "./assets/images/onion.png",
    sauce: "./assets/images/sauce.png",
    cheese: "./assets/images/cheese.png",
    sweet: "./assets/images/sweetpotato.png",
    dough: "./assets/images/dough.png",
    bomb: "./assets/images/bomb.png",
    potato: "./assets/images/potato.png",
    player: "./assets/images/player_box.png"
  };

  Object.entries(paths).forEach(([key, src]) => {
    images[key] = new Image();
    images[key].src = src;
  });

  let W = 0, H = 0, DPR = 1;
  let state = "ready";
  let last = 0;
  let spawnTimer = 0;
  let pointerId = null;
  let items = [];
  let texts = [];
  let particles = [];
  let smoke = [];
  let player = null;

  let game = {
    score: 0,
    lives: 3,
    elapsed: 0,
    remaining: 30,
    combo: 0,
    mission: null,
    best: 0,
    goldenSpawned: 0,
    lastBomb: -99
  };

  const rnd = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const targetWidth = clamp(W * 0.38, 210, 520);
    const ratio = 1600 / 824;
    const targetHeight = targetWidth / ratio;

    if (!player) {
      player = { x: W / 2, tx: W / 2, tilt: 0, targetTilt: 0 };
    }
    Object.assign(player, {
      w: targetWidth,
      h: targetHeight,
      y: H - targetHeight - Math.max(4, H * 0.005)
    });

    player.x = player.tx = clamp(player.x, player.w * 0.36, W - player.w * 0.36);
  }

  function resetGame() {
    game = {
      score: 0,
      lives: 3,
      elapsed: 0,
      remaining: 30,
      combo: 0,
      mission: PizzaMissions.create(),
      best: Number(localStorage.getItem("pizzaBest500") || 0),
      goldenSpawned: 0,
      lastBomb: -99
    };

    items = [];
    texts = [];
    particles = [];
    smoke = [];
    spawnTimer = 0;
    player.x = player.tx = W / 2;
    player.tilt = player.targetTilt = 0;

    UI.els.bestScore.textContent = game.best;
    UI.update(game);
  }

  async function begin() {
    if (state === "playing" || state === "countdown") return;

    PizzaAudio.unlock();
    resetGame();

    UI.els.start.classList.add("hidden");
    UI.els.result.classList.add("hidden");
    UI.els.pause.classList.add("hidden");
    UI.els.hud.classList.remove("hidden");
    UI.els.countdown.classList.remove("hidden");

    state = "countdown";

    for (const value of ["3", "2", "1", "START!"]) {
      UI.els.countdownText.textContent = value;
      PizzaAudio.beep(value === "START!" ? 700 : 450, 0.08, "square", 0.04);
      await wait(value === "START!" ? 450 : 650);
    }

    UI.els.countdown.classList.add("hidden");
    state = "playing";
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function spawnOne(forceType = null) {
    const item = PizzaItems.make(W, game.elapsed, forceType);
    items.push(item);
  }

  function maybeSpawn() {
    const profile = PizzaItems.profile(game.elapsed);
    spawnOne();

    if (Math.random() < 0.13) {
      spawnOne(Math.random() < 0.55 ? "bomb" : null);
    }

    if (
      game.goldenSpawned < 3 &&
      game.elapsed > 4 &&
      Math.random() < 0.045
    ) {
      spawnOne("golden");
      game.goldenSpawned++;
    }

    spawnTimer = rnd(profile.gap[0], profile.gap[1]);
  }

  function loop(now) {
    if (state !== "playing") return;

    const dt = Math.min((now - last) / 1000, 0.034);
    last = now;

    game.elapsed += dt;
    game.remaining -= dt;

    if (PizzaMissions.update(game.mission, "tick", { elapsed: game.elapsed })) {
      game.score += 50;
      floatText(W / 2, H * 0.34, "MISSION +50", false, 1.15);
    }

    if (game.remaining <= 0) {
      game.remaining = 0;
      finish();
      return;
    }

    const follow = Math.min(1, dt * (W < 700 ? 20 : 13));
    player.x += (player.tx - player.x) * follow;
    player.tilt += (player.targetTilt - player.tilt) * Math.min(1, dt * 12);
    player.targetTilt *= Math.pow(0.06, dt);

    spawnTimer -= dt;
    if (spawnTimer <= 0) maybeSpawn();

    updateItems(dt);
    updateEffects(dt);
    draw();
    UI.update(game);

    requestAnimationFrame(loop);
  }

  function updateItems(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];

      item.y += item.speed * dt;
      item.rotation += item.spin * dt;
      item.wave += item.waveSpeed * dt;

      const drawX = item.x + Math.sin(item.wave) * item.amp;

      const catchY = player.y + player.h * 0.22;
      const hit =
        Math.abs(drawX - player.x) < player.w * 0.31 + item.size * 0.28 &&
        item.y + item.size * 0.34 >= catchY &&
        item.y - item.size * 0.25 <= player.y + player.h * 0.58;

      if (hit) {
        collect(item, drawX);
        items.splice(i, 1);
      } else if (item.y - item.size > H) {
        if (item.type !== "bomb") game.combo = 0;
        items.splice(i, 1);
      }
    }
  }

  function multiplier() {
    return game.remaining <= 8 ? 2 : 1;
  }

  function collect(item, x) {
    if (item.type === "bomb") {
      if (game.elapsed - game.lastBomb < 0.35) return;
      game.lastBomb = game.elapsed;

      PizzaMissions.update(game.mission, "bomb", {});
      game.score = Math.max(0, game.score - 10);
      game.lives--;
      game.combo = 0;

      floatText(x, player.y + 12, "BOOM! -10", true, 1.25);
      makeExplosion(x, player.y + 10);
      shakeScreen();
      PizzaAudio.beep(85, 0.18, "sawtooth", 0.08);

      if (navigator.vibrate) navigator.vibrate([80, 35, 110]);

      if (game.lives <= 0) finish();
      return;
    }

    if (item.type === "golden") {
      const pts = 50 * multiplier();
      game.score += pts;
      floatText(x, player.y - 10, `✨ GOLD +${pts} ✨`, false, 1.3);
      burst(x, player.y, 28);
      PizzaAudio.beep(930, 0.13, "sine", 0.06);
      if (navigator.vibrate) navigator.vibrate([30, 25, 30]);
      return;
    }

    const pts = 10 * multiplier();
    game.score += pts;
    game.combo++;

    PizzaMissions.update(game.mission, "collect", { type: item.type });
    PizzaMissions.update(game.mission, "combo", { combo: game.combo });

    floatText(x, player.y - 12, `+${pts}`, false, 1);
    burst(x, player.y + 4, 10);
    PizzaAudio.beep(520 + Math.min(game.combo, 15) * 18);

    if (game.combo === 5) {
      game.score += 20;
      floatText(W / 2, H * 0.4, "COMBO +20", false, 1.05);
    }
    if (game.combo === 10) {
      game.score += 50;
      floatText(W / 2, H * 0.4, "MASTER +50", false, 1.18);
    }
    if (game.combo === 15) {
      game.score += 100;
      floatText(W / 2, H * 0.4, "LEGEND +100", false, 1.3);
    }
  }

  function floatText(x, y, text, bad = false, size = 1) {
    texts.push({ x, y, text, bad, size, life: 0.95, max: 0.95 });
  }

  function burst(x, y, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: rnd(-180, 180),
        vy: rnd(-235, -65),
        gravity: rnd(300, 500),
        size: rnd(3, 8),
        life: rnd(0.45, 0.85),
        max: 0.85
      });
    }
  }

  function makeExplosion(x, y) {
    for (let i = 0; i < 24; i++) {
      particles.push({
        x, y,
        vx: rnd(-260, 260),
        vy: rnd(-290, 80),
        gravity: rnd(230, 420),
        size: rnd(5, 12),
        life: rnd(0.45, 0.85),
        max: 0.85,
        explosion: true
      });
    }

    for (let i = 0; i < 9; i++) {
      smoke.push({
        x: x + rnd(-20, 20),
        y: y + rnd(-10, 15),
        vx: rnd(-35, 35),
        vy: rnd(-85, -25),
        size: rnd(18, 40),
        life: rnd(0.65, 1.15),
        max: 1.15
      });
    }
  }

  function shakeScreen() {
    const app = UI.els.app;
    app.classList.remove("bomb-hit");
    void app.offsetWidth;
    app.classList.add("bomb-hit");
    setTimeout(() => app.classList.remove("bomb-hit"), 480);
  }

  function updateEffects(dt) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt;
      t.y -= 58 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.size += 18 * dt;
      if (s.life <= 0) smoke.splice(i, 1);
    }
  }

  function drawItem(item) {
    const x = item.x + Math.sin(item.wave) * item.amp;

    ctx.save();
    ctx.translate(x, item.y);
    ctx.rotate(item.rotation);

    if (item.type === "golden") {
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 30;
      ctx.font = `900 ${item.size * 0.76}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍕", 0, 0);
    } else {
      ctx.shadowColor = "rgba(0,0,0,.3)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 7;
      ctx.drawImage(
        images[item.type],
        -item.size / 2,
        -item.size / 2,
        item.size,
        item.size
      );
    }

    ctx.restore();
  }

  function drawPlayer() {
    if (!images.player.complete) return;

    ctx.save();
    ctx.translate(player.x, player.y + player.h / 2);
    ctx.rotate(player.tilt);

    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;

    ctx.drawImage(
      images.player,
      -player.w / 2,
      -player.h / 2,
      player.w,
      player.h
    );

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const item of items) drawItem(item);
    drawPlayer();

    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.explosion
        ? (Math.random() > 0.45 ? "#ff6a00" : "#ffd83d")
        : "#ffe448";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const s of smoke) {
      ctx.save();
      ctx.globalAlpha = clamp(s.life / s.max, 0, 0.5);
      ctx.fillStyle = "#242424";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const t of texts) {
      ctx.save();
      ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
      ctx.translate(t.x, t.y);
      ctx.scale(t.size, t.size);
      ctx.font = "900 30px Arial";
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = t.bad ? "#ffffff" : "#d71920";
      ctx.fillStyle = t.bad ? "#151515" : "#ffe448";
      ctx.strokeText(t.text, 0, 0);
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  async function finish() {
    if (state === "finished") return;
    state = "finished";

    game.best = Math.max(game.best, game.score);
    localStorage.setItem("pizzaBest500", String(game.best));
    UI.els.bestScore.textContent = game.best;

    const rank = UI.getRank(game.score);
    const success = game.score >= 500;

    if (success) {
      floatText(W / 2, H * 0.39, "🔥 오븐에서 굽는 중... 🔥", false, 1.05);
      draw();
      await wait(1150);
      PizzaAudio.beep(1040, 0.22, "sine", 0.06);
    }

    $("resultTitle").textContent = success ? "딩! 피자 완성!" : "도전 종료!";
    $("resultRank").textContent = rank;
    $("resultMessage").innerHTML =
      `최종 점수 <strong>${game.score}점</strong><br>` +
      (success ? "선명희피자가 맛있게 완성됐어요!" : "500점에 다시 도전해보세요.");

    $("successBox").classList.toggle("hidden", !success);
    $("saveButton").classList.toggle("hidden", !success);

    if (success) {
      const d = new Date();
      const datePart =
        String(d.getFullYear()).slice(-2) +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");

      $("successCode").textContent =
        `PZ-${datePart}-${Math.floor(10000 + Math.random() * 90000)}`;

      if (navigator.vibrate) navigator.vibrate([60, 35, 60, 35, 150]);
    }

    setTimeout(() => UI.els.result.classList.remove("hidden"), 240);
  }

  function saveResult() {
    const c = document.createElement("canvas");
    const x = c.getContext("2d");
    c.width = 1080;
    c.height = 1350;

    const gradient = x.createLinearGradient(0, 0, 0, 1350);
    gradient.addColorStop(0, "#d71920");
    gradient.addColorStop(1, "#8e0f14");

    x.fillStyle = gradient;
    x.fillRect(0, 0, c.width, c.height);

    x.fillStyle = "#fff8e8";
    x.roundRect(90, 115, 900, 1120, 48);
    x.fill();

    x.textAlign = "center";
    x.fillStyle = "#d71920";
    x.font = "900 58px Arial";
    x.fillText("선명희피자", 540, 250);

    x.font = "900 74px Arial";
    x.fillText("500점 챌린지", 540, 370);

    x.font = "900 150px Arial";
    x.fillText(UI.getRank(game.score), 540, 570);

    x.fillStyle = "#2d201c";
    x.font = "900 48px Arial";
    x.fillText(`최종 점수 ${game.score}점`, 540, 700);

    x.fillStyle = "#d71920";
    x.font = "900 46px Arial";
    x.fillText($("successCode").textContent, 540, 850);

    const a = document.createElement("a");
    a.download = `선명희피자_${game.score}점.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  }

  function movePlayer(clientX) {
    if (state !== "playing") return;

    const previousTarget = player.tx;
    player.tx = clamp(clientX, player.w * 0.36, W - player.w * 0.36);

    const delta = player.tx - previousTarget;
    player.targetTilt = clamp(delta / 420, -0.09, 0.09);
  }

  canvas.addEventListener("pointerdown", e => {
    pointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    movePlayer(e.clientX);
  }, { passive: true });

  canvas.addEventListener("pointermove", e => {
    if (pointerId === null || pointerId === e.pointerId) movePlayer(e.clientX);
  }, { passive: true });

  canvas.addEventListener("pointerup", e => {
    if (e.pointerId === pointerId) pointerId = null;
  }, { passive: true });

  $("startButton").onclick = begin;
  $("retryButton").onclick = () => {
    UI.els.result.classList.add("hidden");
    UI.els.start.classList.remove("hidden");
    UI.els.hud.classList.add("hidden");
    state = "ready";
  };
  $("pauseButton").onclick = () => {
    if (state === "playing") {
      state = "paused";
      UI.els.pause.classList.remove("hidden");
    }
  };
  $("resumeButton").onclick = () => {
    if (state === "paused") {
      UI.els.pause.classList.add("hidden");
      state = "playing";
      last = performance.now();
      requestAnimationFrame(loop);
    }
  };
  $("soundButton").onclick = () => {
    $("soundButton").textContent = PizzaAudio.toggle() ? "🔊" : "🔇";
  };
  $("saveButton").onclick = saveResult;

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") $("pauseButton").click();
  });

  resize();
  resetGame();
})();