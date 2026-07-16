(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const startScreen = $("startScreen");
  const resultScreen = $("resultScreen");
  const gameArea = $("gameArea");
  const hud = $("hud");
  const board = $("board");
  const notice = $("notice");
  const scoreEl = $("score");
  const timeEl = $("time");
  const pairsEl = $("pairs");
  const progress = $("progress");
  const buildStage = $("buildStage");
  const countdown = $("countdown");
  const countdownText = $("countdownText");
  const resultPizzaImage = $("resultPizzaImage");

  const CARD_IMAGES = Array.from(
    { length: 10 },
    (_, i) => `./assets/cards/pizza_${String(i + 1).padStart(2, "0")}.png`
  );

  const CONFIG = {
    time: 45,
    preview: 3.5,
    mismatchDelay: 750
  };

  let cards = [];
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let score = 0;
  let matchedPairs = 0;
  let remaining = CONFIG.time;
  let timerId = null;
  let state = "ready";
  let streak = 0;

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function createDeck() {
    const deck = CARD_IMAGES.flatMap((src, pairId) => [
      { pairId, src, uid: `${pairId}-a` },
      { pairId, src, uid: `${pairId}-b` }
    ]);
    return shuffle(deck);
  }

  function renderBoard() {
    board.innerHTML = "";

    cards.forEach(cardData => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card";
      card.dataset.pairId = String(cardData.pairId);
      card.dataset.uid = cardData.uid;
      card.innerHTML = `
        <span class="card-face card-back"></span>
        <span class="card-face card-front">
          <img src="${cardData.src}" alt="피자 카드">
        </span>
      `;
      card.addEventListener("click", () => flipCard(card));
      board.appendChild(card);
    });
  }

  async function startGame() {
    if (state === "playing" || state === "preview") return;

    clearInterval(timerId);

    cards = createDeck();
    firstCard = null;
    secondCard = null;
    lockBoard = true;
    score = 0;
    matchedPairs = 0;
    remaining = CONFIG.time;
    streak = 0;
    state = "preview";

    updateHUD();
    renderBoard();

    startScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
    gameArea.classList.remove("hidden");
    hud.classList.remove("hidden");

    countdown.classList.remove("hidden");

    for (const value of ["3", "2", "1"]) {
      countdownText.textContent = value;
      await wait(620);
    }

    countdown.classList.add("hidden");

    notice.textContent = `카드 위치를 ${CONFIG.preview}초 동안 기억하세요!`;
    document.querySelectorAll(".card").forEach(card => {
      card.classList.add("flipped");
    });

    await wait(CONFIG.preview * 1000);

    document.querySelectorAll(".card:not(.matched)").forEach(card => {
      card.classList.remove("flipped");
    });

    notice.textContent = "같은 피자 2장을 찾아보세요!";
    lockBoard = false;
    state = "playing";
    startTimer();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function startTimer() {
    clearInterval(timerId);

    timerId = setInterval(() => {
      remaining -= 1;
      updateHUD();

      if (remaining <= 0) {
        remaining = 0;
        finishGame(false);
      }
    }, 1000);
  }

  function flipCard(card) {
    if (state !== "playing" || lockBoard) return;
    if (card === firstCard) return;
    if (card.classList.contains("matched")) return;

    card.classList.add("flipped");

    if (!firstCard) {
      firstCard = card;
      return;
    }

    secondCard = card;
    lockBoard = true;

    if (firstCard.dataset.pairId === secondCard.dataset.pairId) {
      handleMatch();
    } else {
      handleMismatch();
    }
  }

  function handleMatch() {
    const matchedFirst = firstCard;
    const matchedSecond = secondCard;

    matchedFirst.classList.remove("flipped");
    matchedSecond.classList.remove("flipped");
    matchedFirst.classList.add("matched");
    matchedSecond.classList.add("matched");

    score = Math.min(200, score + 20);
    matchedPairs += 1;
    streak += 1;

    let message = "+20점! 같은 피자를 찾았어요.";
    if (streak === 3) message = "✨ COMBO x3!";
    if (streak === 5) message = "🔥 PIZZA MASTER!";
    if (streak === 7) message = "👑 PIZZA KING!";
    if (streak === 10) message = "🎉 PERFECT!";

    notice.textContent = message;
    resetTurn();
    updateHUD();

    if (matchedPairs >= 10 || score >= 200) {
      setTimeout(() => finishGame(true), 450);
    }
  }

  function handleMismatch() {
    const wrongFirst = firstCard;
    const wrongSecond = secondCard;

    score = Math.max(0, score - 5);
    streak = 0;
    notice.textContent = "-5점! 다른 피자예요.";
    updateHUD();

    setTimeout(() => {
      wrongFirst?.classList.remove("flipped");
      wrongSecond?.classList.remove("flipped");
      resetTurn();
    }, CONFIG.mismatchDelay);
  }

  function resetTurn() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
  }

  function getBuildStage(currentScore) {
    if (currentScore < 20) return "도우를 준비해요!";
    if (currentScore < 40) return "🍞 도우 완성!";
    if (currentScore < 60) return "🍅 소스를 바르는 중!";
    if (currentScore < 80) return "🧀 치즈를 듬뿍!";
    if (currentScore < 120) return "🥓 토핑을 올리는 중!";
    if (currentScore < 160) return "🔥 오븐에서 굽는 중!";
    if (currentScore < 200) return "🍕 거의 완성됐어요!";
    return "🎉 피자 완성!";
  }

  function updateHUD() {
    scoreEl.textContent = score;
    timeEl.textContent = Math.max(0, remaining);
    pairsEl.textContent = Math.max(0, 10 - matchedPairs);
    progress.style.width = `${Math.min(100, (score / 200) * 100)}%`;
    buildStage.textContent = getBuildStage(score);
    hud.classList.toggle(
      "last-seconds",
      state === "playing" && remaining <= 10
    );
  }

  function finishGame(success) {
    if (state === "finished") return;

    state = "finished";
    clearInterval(timerId);
    lockBoard = true;

    $("resultTitle").textContent = success ? "피자 완성!" : "시간 종료!";
    $("resultIcon").textContent = success ? "🍕" : "⏰";
    $("resultMessage").innerHTML = success
      ? `축하합니다!<br><strong>${score}점</strong>을 달성했어요.`
      : `최종 점수 <strong>${score}점</strong><br>다시 도전해 200점을 완성해보세요.`;

    const successBox = $("successBox");

    if (success) {
      const randomPizza =
        CARD_IMAGES[Math.floor(Math.random() * CARD_IMAGES.length)];

      resultPizzaImage.src = randomPizza;
      resultPizzaImage.classList.remove("hidden");
      $("resultIcon").classList.add("hidden");

      const date = new Date();
      const datePart =
        String(date.getFullYear()).slice(-2) +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0");

      $("successCode").textContent =
        `MEM-${datePart}-${Math.floor(10000 + Math.random() * 90000)}`;

      successBox.classList.remove("hidden");
    } else {
      resultPizzaImage.classList.add("hidden");
      $("resultIcon").classList.remove("hidden");
      successBox.classList.add("hidden");
    }

    setTimeout(() => {
      resultScreen.classList.remove("hidden");
    }, 300);
  }

  function resetToStart() {
    clearInterval(timerId);
    state = "ready";
    firstCard = null;
    secondCard = null;
    lockBoard = false;

    resultScreen.classList.add("hidden");
    gameArea.classList.add("hidden");
    hud.classList.add("hidden");
    startScreen.classList.remove("hidden");

    remaining = CONFIG.time;
    score = 0;
    matchedPairs = 0;
    streak = 0;
    updateHUD();
  }

  $("startButton").addEventListener("click", startGame);
  $("retryButton").addEventListener("click", resetToStart);

  updateHUD();
})();
