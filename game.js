(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = $("gameRoot");
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    hud: $("hud"),
    startScreen: $("startScreen"),
    countdown: $("countdown"),
    countdownText: $("countdownText"),
    pauseScreen: $("pauseScreen"),
    resultScreen: $("resultScreen"),
    hearts: $("hearts"),
    bestScore: $("bestScore"),
    score: $("score"),
    time: $("time"),
    rank: $("rank"),
    progressBar: $("progressBar"),
    pizzaStage: $("pizzaStage"),
    missionText: $("missionText"),
    missionProgress: $("missionProgress"),
    feverBanner: $("feverBanner"),
    resultTitle: $("resultTitle"),
    resultRank: $("resultRank"),
    resultMessage: $("resultMessage"),
    successBox: $("successBox"),
    successCode: $("successCode"),
    startBtn: $("startBtn"),
    retryBtn: $("retryBtn"),
    pauseBtn: $("pauseBtn"),
    resumeBtn: $("resumeBtn"),
    soundBtn: $("soundBtn")
  };

  const imageSources = {
    onion: "./assets/images/onion.png",
    tomato: "./assets/images/tomato.png",
    cheese: "./assets/images/cheese.png",
    sweetpotato: "./assets/images/sweetpotato.png",
    dough: "./assets/images/dough.png",
    potato: "./assets/images/potato.png",
    bomb: "./assets/images/bomb.png",
    player: "./assets/images/player_box.png"
  };

  const images = {};
  for (const [key, src] of Object.entries(imageSources)) {
    const img = new Image();
    img.src = src;
    images[key] = img;
  }

  const normalTypes = ["onion", "tomato", "cheese", "sweetpotato", "dough", "potato"];
  const missions = [
    { type: "collect", key: "onion", target: 6, text: "양파 6개 받기" },
    { type: "collect", key: "sweetpotato", target: 6, text: "고구마 6개 받기" },
    { type: "collect", key: "potato", target: 6, text: "감자 6개 받기" },
    { type: "combo", target: 10, text: "10콤보 달성하기" }
  ];

  let W = 0;
  let H = 0;
  let DPR = 1;
  let state = "ready";
  let lastTime = 0;
  let spawnTimer = 0;
  let pointerId = null;
  let items = [];
  let particles = [];
  let texts = [];
  let player = null;
  let audioContext = null;
  let soundEnabled = true;

  let game = {};

  const rnd = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function rankFor(score) {
    if (score >= 700) return "SSS";
    if (score >= 600) return "SS";
    if (score >= 500) return "S";
    if (score >= 400) return "A";
    if (score >= 300) return "B";
    return "C";
  }

  function stageFor(score) {
    if (score < 100) return "🍞 도우 준비";
    if (score < 200) return "🍅 소스 완성";
    if (score < 300) return "🧀 치즈 듬뿍";
    if (score < 400) return "🥔 토핑 추가";
    if (score < 500) return "🔥 오븐에서 굽는 중";
    return "🍕 피자 완성!";
  }

  function spawnProfile(elapsed) {
    if (elapsed < 8) return { gap: [0.22, 0.30], bomb: 0.20, min: 330, max: 470 };
    if (elapsed < 16) return { gap: [0.17, 0.24], bomb: 0.28, min: 420, max: 590 };
    if (elapsed < 22) return { gap: [0.13, 0.19], bomb: 0.36, min: 520, max: 700 };
    return { gap: [0.10, 0.15], bomb: 0.44, min: 620, max: 860 };
  }

  function unlockAudio() {
    if (!audioContext) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audioContext = new AudioClass();
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
  }

  function beep(freq, duration = 0.06, type = "sine", volume = 0.035) {
    if (!soundEnabled || !audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = freq;
    oscillator.type = type;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const playerWidth = clamp(W * 0.34, 230, 520);
    const ratio = 1600 / 824;
    const playerHeight = playerWidth / ratio;

    if (!player) {
      player = { x: W / 2, targetX: W / 2, tilt: 0, targetTilt: 0 };
    }

    player.w = playerWidth;
    player.h = playerHeight;
    player.y = H - playerHeight * 0.86;
    player.x = clamp(player.x, player.w * 0.32, W - player.w * 0.32);
    player.targetX = clamp(player.targetX, player.w * 0.32, W - player.w * 0.32);
  }

  function newMission() {
    const mission = { ...missions[Math.floor(Math.random() * missions.length)] };
    mission.progress = 0;
    mission.completed = false;
    return mission;
  }

  function resetGame() {
    game = {
      score: 0,
      lives: 3,
      elapsed: 0,
      remaining: 30,
      combo: 0,
      best: Number(localStorage.getItem("pizzaDeluxeBest") || 0),
      goldenCount: 0,
      mission: newMission(),
      lastBombAt: -99
    };

    items = [];
    particles = [];
    texts = [];
    spawnTimer = 0;
    player.x = player.targetX = W / 2;
    player.tilt = player.targetTilt = 0;
    updateHud();
  }

  async function startGame() {
    if (state === "countdown" || state === "playing") return;

    unlockAudio();
    resetGame();
    ui.startScreen.classList.add("is-hidden");
    ui.resultScreen.classList.add("is-hidden");
    ui.pauseScreen.classList.add("is-hidden");
    ui.hud.classList.remove("is-hidden");
    ui.countdown.classList.remove("is-hidden");
    state = "countdown";

    for (const value of ["3", "2", "1", "START!"]) {
      ui.countdownText.textContent = value;
      beep(value === "START!" ? 700 : 440, 0.08, "square", 0.04);
      await sleep(value === "START!" ? 450 : 650);
    }

    ui.countdown.classList.add("is-hidden");
    state = "playing";
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function createItem(forceType = null) {
    const profile = spawnProfile(game.elapsed);
    let type = forceType;

    if (!type) {
      type = Math.random() < profile.bomb
        ? "bomb"
        : normalTypes[Math.floor(Math.random() * normalTypes.length)];
    }

    const size = W < 600 ? rnd(50, 68) : rnd(58, 78);

    return {
      type,
      x: rnd(size, W - size),
      y: -size - rnd(0, 45),
      size,
      speed: rnd(profile.min, profile.max),
      rotation: rnd(-0.3, 0.3),
      spin: rnd(-5.5, 5.5),
      wave: rnd(0, Math.PI * 2),
      waveSpeed: type === "bomb" ? rnd(6, 9) : rnd(2.5, 4.5),
      amplitude: type === "bomb" ? rnd(18, 38) : rnd(5, 12)
    };
  }

  function spawnItems() {
    const profile = spawnProfile(game.elapsed);
    items.push(createItem());

    if (Math.random() < 0.10) items.push(createItem());

    if (game.goldenCount < 3 && game.elapsed > 4 && Math.random() < 0.05) {
      items.push(createItem("golden"));
      game.goldenCount++;
    }

    spawnTimer = rnd(profile.gap[0], profile.gap[1]);
  }

  function loop(now) {
    if (state !== "playing") return;

    const dt = Math.min((now - lastTime) / 1000, 0.034);
    lastTime = now;
    game.elapsed += dt;
    game.remaining -= dt;

    if (game.remaining <= 0) {
      game.remaining = 0;
      finishGame();
      return;
    }

    const follow = Math.min(1, dt * (W < 700 ? 22 : 15));
    player.x += (player.targetX - player.x) * follow;
    player.tilt += (player.targetTilt - player.tilt) * Math.min(1, dt * 11);
    player.targetTilt *= Math.pow(0.04, dt);

    spawnTimer -= dt;
    if (spawnTimer <= 0) spawnItems();

    updateItems(dt);
    updateEffects(dt);
    updateHud();
    draw();

    requestAnimationFrame(loop);
  }

  function updateItems(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.y += item.speed * dt;
      item.rotation += item.spin * dt;
      item.wave += item.waveSpeed * dt;

      const drawX = item.x + Math.sin(item.wave) * item.amplitude;
      const catchLine = player.y + player.h * 0.20;

      const hit =
        Math.abs(drawX - player.x) < player.w * 0.29 + item.size * 0.25 &&
        item.y + item.size * 0.34 >= catchLine &&
        item.y - item.size * 0.24 <= player.y + player.h * 0.50;

      if (hit) {
        collectItem(item, drawX);
        items.splice(i, 1);
      } else if (item.y - item.size > H) {
        if (item.type !== "bomb") game.combo = 0;
        items.splice(i, 1);
      }
    }
  }

  function scoreMultiplier() {
    return game.remaining <= 8 ? 2 : 1;
  }

  function collectItem(item, x) {
    if (item.type === "bomb") {
      if (game.elapsed - game.lastBombAt < 0.35) return;
      game.lastBombAt = game.elapsed;
      game.score = Math.max(0, game.score - 10);
      game.lives--;
      game.combo = 0;

      addText(x, player.y, "BOOM! -10", true, 1.25);
      explosion(x, player.y + 10);
      triggerBombEffect();
      beep(85, 0.18, "sawtooth", 0.08);
      if (navigator.vibrate) navigator.vibrate([80, 35, 110]);

      if (game.lives <= 0) finishGame();
      return;
    }

    if (item.type === "golden") {
      const points = 50 * scoreMultiplier();
      game.score += points;
      addText(x, player.y - 8, `✨ GOLD +${points} ✨`, false, 1.25);
      burst(x, player.y, 28, true);
      beep(940, 0.14, "sine", 0.06);
      return;
    }

    const points = 10 * scoreMultiplier();
    game.score += points;
    game.combo++;

    if (game.mission.type === "collect" && game.mission.key === item.type) {
      game.mission.progress++;
    }
    if (game.mission.type === "combo") {
      game.mission.progress = Math.max(game.mission.progress, game.combo);
    }

    if (!game.mission.completed && game.mission.progress >= game.mission.target) {
      game.mission.completed = true;
      game.score += 50;
      addText(W / 2, H * 0.34, "MISSION +50", false, 1.15);
    }

    addText(x, player.y - 10, `+${points}`, false, 1);
    burst(x, player.y + 4, 10, false);
    beep(520 + Math.min(game.combo, 15) * 18, 0.05);

    if (game.combo === 5) {
      game.score += 20;
      addText(W / 2, H * 0.41, "COMBO +20", false, 1.05);
    } else if (game.combo === 10) {
      game.score += 50;
      addText(W / 2, H * 0.41, "MASTER +50", false, 1.18);
    } else if (game.combo === 15) {
      game.score += 100;
      addText(W / 2, H * 0.41, "LEGEND +100", false, 1.3);
    }
  }

  function addText(x, y, text, bad = false, scale = 1) {
    texts.push({ x, y, text, bad, scale, life: 0.95, max: 0.95 });
  }

  function burst(x, y, count, golden) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: rnd(-190, 190),
        vy: rnd(-240, -70),
        gravity: rnd(300, 480),
        size: rnd(3, 8),
        life: rnd(0.45, 0.85),
        max: 0.85,
        color: golden ? (Math.random() > 0.5 ? "#fff3a1" : "#ffd21f") : "#ffe448"
      });
    }
  }

  function explosion(x, y) {
    for (let i = 0; i < 30; i++) {
      particles.push({
        x, y,
        vx: rnd(-280, 280),
        vy: rnd(-300, 90),
        gravity: rnd(240, 430),
        size: rnd(5, 12),
        life: rnd(0.45, 0.9),
        max: 0.9,
        color: Math.random() > 0.5 ? "#ff6a00" : "#ffd83d"
      });
    }
  }

  function triggerBombEffect() {
    root.classList.remove("bomb-hit");
    void root.offsetWidth;
    root.classList.add("bomb-hit");
    setTimeout(() => root.classList.remove("bomb-hit"), 460);
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
  }

  function updateHud() {
    ui.score.textContent = game.score;
    ui.time.textContent = Math.max(0, Math.ceil(game.remaining));
    ui.rank.textContent = rankFor(game.score);
    ui.progressBar.style.width = Math.min(100, (game.score / 500) * 100) + "%";
    ui.pizzaStage.textContent = stageFor(game.score);
    ui.bestScore.textContent = game.best;

    ui.hearts.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement("span");
      heart.textContent = "❤️";
      heart.className = "heart" + (i >= game.lives ? " off" : "");
      ui.hearts.appendChild(heart);
    }

    ui.missionText.textContent = game.mission.text;
    ui.missionProgress.textContent =
      `${Math.min(game.mission.progress, game.mission.target)} / ${game.mission.target}`;

    const fever = game.remaining <= 8;
    ui.feverBanner.classList.toggle("is-hidden", !fever);
    root.classList.toggle("fever", fever);
  }

  function drawItem(item) {
    const drawX = item.x + Math.sin(item.wave) * item.amplitude;
    ctx.save();
    ctx.translate(drawX, item.y);
    ctx.rotate(item.rotation);

    if (item.type === "golden") {
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 30;
      ctx.font = `900 ${item.size * 0.76}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍕", 0, 0);
    } else {
      const img = images[item.type];
      if (img && img.complete) {
        ctx.shadowColor = "rgba(0,0,0,.26)";
        ctx.shadowBlur = 9;
        ctx.shadowOffsetY = 6;
        ctx.drawImage(img, -item.size / 2, -item.size / 2, item.size, item.size);
      }
    }

    ctx.restore();
  }

  function drawPlayer() {
    const img = images.player;
    if (!img || !img.complete) return;

    ctx.save();
    ctx.translate(player.x, player.y + player.h / 2);
    ctx.rotate(player.tilt);
    ctx.shadowColor = "rgba(0,0,0,.32)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(img, -player.w / 2, -player.h / 2, player.w, player.h);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const item of items) drawItem(item);
    drawPlayer();

    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const t of texts) {
      ctx.save();
      ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);
      ctx.font = "900 30px Arial";
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = t.bad ? "#fff" : "#d91e24";
      ctx.fillStyle = t.bad ? "#151515" : "#ffe448";
      ctx.strokeText(t.text, 0, 0);
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  async function finishGame() {
    if (state === "finished") return;
    state = "finished";

    game.best = Math.max(game.best, game.score);
    localStorage.setItem("pizzaDeluxeBest", String(game.best));

    const success = game.score >= 500;
    const rank = rankFor(game.score);

    if (success) {
      addText(W / 2, H * 0.38, "🔥 오븐에서 굽는 중... 🔥", false, 1.05);
      draw();
      await sleep(1100);
      beep(1040, 0.22, "sine", 0.06);
    }

    ui.resultTitle.textContent = success ? "딩! 피자 완성!" : "도전 종료!";
    ui.resultRank.textContent = rank;
    ui.resultMessage.innerHTML =
      `최종 점수 <strong>${game.score}점</strong><br>` +
      (success ? "선명희피자가 맛있게 완성됐어요!" : "500점에 다시 도전해보세요.");

    ui.successBox.classList.toggle("is-hidden", !success);

    if (success) {
      const d = new Date();
      const dateCode =
        String(d.getFullYear()).slice(-2) +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
      ui.successCode.textContent =
        `PZ-${dateCode}-${Math.floor(10000 + Math.random() * 90000)}`;
      if (navigator.vibrate) navigator.vibrate([60, 35, 60, 35, 150]);
    }

    ui.resultScreen.classList.remove("is-hidden");
  }

  function movePlayer(clientX) {
    if (state !== "playing") return;

    const previous = player.targetX;
    player.targetX = clamp(clientX, player.w * 0.32, W - player.w * 0.32);
    const delta = player.targetX - previous;
    player.targetTilt = clamp(delta / 430, -0.09, 0.09);
  }

  canvas.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    movePlayer(event.clientX);
  }, { passive: true });

  canvas.addEventListener("pointermove", (event) => {
    if (pointerId === null || pointerId === event.pointerId) movePlayer(event.clientX);
  }, { passive: true });

  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId === pointerId) pointerId = null;
  }, { passive: true });

  ui.startBtn.addEventListener("click", startGame);
  ui.retryBtn.addEventListener("click", () => {
    ui.resultScreen.classList.add("is-hidden");
    ui.startScreen.classList.remove("is-hidden");
    ui.hud.classList.add("is-hidden");
    root.classList.remove("fever", "bomb-hit");
    state = "ready";
  });

  ui.pauseBtn.addEventListener("click", () => {
    if (state === "playing") {
      state = "paused";
      ui.pauseScreen.classList.remove("is-hidden");
    }
  });

  ui.resumeBtn.addEventListener("click", () => {
    if (state === "paused") {
      ui.pauseScreen.classList.add("is-hidden");
      state = "playing";
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  });

  ui.soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    ui.soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
    if (soundEnabled) unlockAudio();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") ui.pauseBtn.click();
  });

  window.addEventListener("resize", resize);

  resize();
  resetGame();
})();