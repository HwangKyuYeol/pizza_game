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
  const countdown = $("countdown");
  const countdownText = $("countdownText");

  const CARD_IMAGES = Array.from({length:10}, (_,i) => `./assets/cards/pizza_${String(i+1).padStart(2,"0")}.png`);

  const LEVELS = {
    easy:   { time:60, preview:5, mismatchDelay:900, shuffleAt:null, label:"60초 · 5초 미리보기" },
    normal: { time:45, preview:4, mismatchDelay:750, shuffleAt:null, label:"45초 · 4초 미리보기" },
    hard:   { time:35, preview:3, mismatchDelay:620, shuffleAt:100, label:"35초 · 3초 미리보기 · 중간 셔플" }
  };

  let selectedLevel = "hard";
  let config = LEVELS[selectedLevel];
  let cards = [];
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let score = 0;
  let matchedPairs = 0;
  let remaining = config.time;
  let timerId = null;
  let state = "ready";
  let hasShuffled = false;

  document.querySelectorAll(".difficulty-buttons button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".difficulty-buttons button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      selectedLevel = button.dataset.level;
      config = LEVELS[selectedLevel];
      $("difficultyDesc").textContent = config.label;
      timeEl.textContent = config.time;
    });
  });

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
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
      card.dataset.pairId = cardData.pairId;
      card.dataset.uid = cardData.uid;
      card.innerHTML = `
        <span class="card-face card-back"></span>
        <span class="card-face card-front"><img src="${cardData.src}" alt="피자 카드"></span>
      `;
      card.addEventListener("click", () => flipCard(card));
      board.appendChild(card);
    });
  }

  async function startGame() {
    if (state === "playing" || state === "preview") return;

    clearInterval(timerId);
    config = LEVELS[selectedLevel];
    cards = createDeck();
    firstCard = null;
    secondCard = null;
    lockBoard = true;
    score = 0;
    matchedPairs = 0;
    remaining = config.time;
    state = "preview";
    hasShuffled = false;

    updateHUD();
    renderBoard();

    startScreen.classList.add("hidden");
    resultScreen.classList.add("hidden");
    gameArea.classList.remove("hidden");
    hud.classList.remove("hidden");

    countdown.classList.remove("hidden");
    for (const value of ["3","2","1"]) {
      countdownText.textContent = value;
      await wait(620);
    }
    countdown.classList.add("hidden");

    notice.textContent = `카드 위치를 ${config.preview}초 동안 기억하세요!`;
    document.querySelectorAll(".card").forEach(card => card.classList.add("flipped"));

    await wait(config.preview * 1000);

    document.querySelectorAll(".card").forEach(card => card.classList.remove("flipped"));
    notice.textContent = "같은 피자 2장을 찾아보세요!";
    lockBoard = false;
    state = "playing";
    startTimer();
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function startTimer() {
    timerId = setInterval(() => {
      remaining -= 1;
      updateHUD();
      if (remaining <= 0) {
        finishGame(false);
      }
    }, 1000);
  }

  function flipCard(card) {
    if (state !== "playing" || lockBoard) return;
    if (card === firstCard || card.classList.contains("matched")) return;

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
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    score = Math.min(200, score + 20);
    matchedPairs += 1;
    notice.textContent = "+20점! 같은 피자를 찾았어요.";
    resetTurn();
    updateHUD();

    if (score >= 200 || matchedPairs >= 10) {
      setTimeout(() => finishGame(true), 450);
      return;
    }

    if (config.shuffleAt && score >= config.shuffleAt && !hasShuffled) {
      hasShuffled = true;
      setTimeout(shuffleUnmatchedCards, 550);
    }
  }

  function handleMismatch() {
    score = Math.max(0, score - 5);
    notice.textContent = "-5점! 다른 피자예요.";
    updateHUD();

    setTimeout(() => {
      firstCard?.classList.remove("flipped");
      secondCard?.classList.remove("flipped");
      resetTurn();
    }, config.mismatchDelay);
  }

  function resetTurn() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
  }

  function shuffleUnmatchedCards() {
    if (state !== "playing") return;

    lockBoard = true;
    notice.textContent = "⚠️ 중간 셔플! 남은 카드 위치가 바뀝니다.";
    board.classList.add("shuffle-alert");

    const unmatchedElements = [...board.querySelectorAll(".card:not(.matched)")];
    const unmatchedData = unmatchedElements.map(el => ({
      pairId: Number(el.dataset.pairId),
      uid: el.dataset.uid,
      src: CARD_IMAGES[Number(el.dataset.pairId)]
    }));

    const shuffledData = shuffle(unmatchedData);

    unmatchedElements.forEach((element, index) => {
      const data = shuffledData[index];
      element.dataset.pairId = data.pairId;
      element.dataset.uid = data.uid;
      element.querySelector("img").src = data.src;
    });

    setTimeout(() => {
      board.classList.remove("shuffle-alert");
      notice.textContent = "남은 카드 위치가 바뀌었어요!";
      lockBoard = false;
    }, 700);
  }

  function updateHUD() {
    scoreEl.textContent = score;
    timeEl.textContent = Math.max(0, remaining);
    pairsEl.textContent = Math.max(0, 10 - matchedPairs);
    progress.style.width = `${Math.min(100, score / 200 * 100)}%`;
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
      const d = new Date();
      const datePart =
        String(d.getFullYear()).slice(-2) +
        String(d.getMonth() + 1).padStart(2,"0") +
        String(d.getDate()).padStart(2,"0");
      $("successCode").textContent = `MEM-${datePart}-${Math.floor(10000 + Math.random() * 90000)}`;
      successBox.classList.remove("hidden");
    } else {
      successBox.classList.add("hidden");
    }

    setTimeout(() => resultScreen.classList.remove("hidden"), 300);
  }

  $("startButton").addEventListener("click", startGame);
  $("retryButton").addEventListener("click", () => {
    resultScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    gameArea.classList.add("hidden");
    hud.classList.add("hidden");
    state = "ready";
  });

  updateHUD();
})();
