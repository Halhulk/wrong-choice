/******************************************************************************************
 WRONG CHOICE – Core Game + Share Only (no leaderboard)
******************************************************************************************/
const API_URL = 'https://YOUR-WORKER-URL.workers.dev'; // if you later add cloud

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────────────
let combo     = 0,
    lastWrong = 0,
    hearts    = 3,
    ended     = false;

let questions = [],
    gameQuestions = [],
    currentCategory = '',
    currentLevel = 'Basic',
    currentIndex = 0,
    score = 0,
    timer = null;

// ─── PLAYER PROFILE / THEME / STREAK ─────────────────────────────────────────────────
const KEY = 'playerData',
      defaultData = { xp:0, level:1, streak:0, lastPlay:'', theme:'light' },
      player = { ...defaultData, ...JSON.parse(localStorage.getItem(KEY)||'{}') };

const today = () => new Date().toISOString().slice(0,10),
      savePlayer = () => localStorage.setItem(KEY, JSON.stringify(player));

// apply theme
const darkBtn = document.getElementById('darkToggle');
if (player.theme==='dark') {
  document.body.classList.add('dark');
  darkBtn.textContent = '☀️';
}
darkBtn.onclick = () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  darkBtn.textContent = isDark?'☀️':'🌙';
  player.theme = isDark?'dark':'light';
  savePlayer();
};

// streak
const streakBadge = document.getElementById('streakBadge');
if (player.lastPlay===today()) {
  // same day, do nothing
} else if (player.lastPlay && (new Date(today())-new Date(player.lastPlay)===86400000)) {
  player.streak++;
} else {
  player.streak=0;
}
player.lastPlay = today();
streakBadge.textContent = `🔥${player.streak}`;
savePlayer();

// ─── LOAD QUESTIONS & DICTIONARY ──────────────────────────────────────────────────────
Promise.all([
  fetch('images.json').then(r=>r.json()),
  fetch('dictionary.json').then(r=>r.json())
]).then(([imgs,dic])=>{
  const byCat = {};
  dic.words.forEach(({word,category}) => {
    (byCat[category] = byCat[category]||[]).push(word);
  });

  questions = imgs.images.map(({file,category}) => {
    const subj = file.split('.')[0],
          path = `images/${file}`,
          wantYes = Math.random()<0.7;

    if (wantYes) {
      return { img:path, text:`Is this ${subj}?`, correct:'yes', category };
    }
    const pool = (byCat[category]||[]).filter(w=>w.toLowerCase()!==subj.toLowerCase());
    if (!pool.length) return null;
    const wrong = pool[Math.floor(Math.random()*pool.length)];
    return { img:path, text:`Is this ${wrong}?`, correct:'no', category };
  }).filter(Boolean).sort(()=>Math.random()-.5);

  // enable category & level buttons
  document.querySelectorAll('.cat').forEach(b=>{
    b.onclick = ()=> setCategory(b.dataset.cat);
    b.classList.remove('active');
  });
  document.getElementById('categorySelect').onchange = e=> setCategory(e.target.value);

  document.querySelectorAll('.level').forEach(b=>{
    b.disabled = false;
    b.onclick = ()=>{
      currentLevel = b.dataset.level;
      startGame();
    };
  });
}).catch(console.error);

// ─── MAIN MENU HANDLERS ──────────────────────────────────────────────────────────────
function setCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat')
          .forEach(b=>b.classList.toggle('active', b.dataset.cat===cat));
  document.getElementById('categorySelect').value = cat;
}

// How to Play modal
document.getElementById('howToPlayBtn').onclick = ()=>
  document.getElementById('howToPlayModal').style.display='flex';
document.getElementById('closeHowToBtn').onclick = ()=>
  document.getElementById('howToPlayModal').style.display='none';

// share buttons
document.getElementById('shareXButton').onclick = ()=> {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('I scored '+score+' in Wrong Choice!')}`);
};
document.getElementById('shareFacebookButton').onclick = ()=> {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`);
};
document.getElementById('shareScore').onclick = ()=> {
  if (navigator.share) {
    navigator.share({ title:'Wrong Choice', text:`I scored ${score}!` });
  } else {
    alert('Native share not supported.');
  }
};

// ─── GAME FLOW ───────────────────────────────────────────────────────────────────────
const speeds = { Basic:7000, Hard:5000, Expert:3000 };
const menu  = document.getElementById('menu');
const game  = document.getElementById('game');
const qImg  = document.getElementById('questionImage');
const qText = document.getElementById('questionText');
const timerBar = document.getElementById('timerBar');
const scoreDisp = document.getElementById('scoreDisplay');
const heartsEl  = document.getElementById('hearts');
const xpBar     = document.getElementById('xpBar');
const levelBadge= document.getElementById('levelBadge');

function startGame() {
  if (!currentCategory) return alert('Pick a category first!');
  gameQuestions = questions.filter(q=>q.category===currentCategory);
  if (!gameQuestions.length) return alert('Empty category.');

  combo     = 0;
  lastWrong = 0;
  hearts    = 3;
  ended     = false;
  score     = 0;
  currentIndex=0;
  renderHearts(); renderXP();

  menu.style.display = 'none';
  game.style.display = 'block';
  document.getElementById('levelName').textContent = `${currentCategory} — ${currentLevel}`;
  scoreDisp.textContent = 'Score: 0';

  // bind buttons
  document.getElementById('yesButton').onclick = ()=> handle('yes');
  document.getElementById('noButton').onclick  = ()=> handle('no');
  document.getElementById('backToMenu').onclick = endToMenu;

  nextQuestion();
}

function nextQuestion(){
  if (currentIndex >= gameQuestions.length) return endGame();

  const q = gameQuestions[currentIndex];
  qImg.src = q.img;
  qText.textContent = q.text;

  // reset timer bar
  timerBar.style.transition='none';
  timerBar.style.width='100%';
  void timerBar.offsetWidth;
  timerBar.style.transition = `width ${speeds[currentLevel]}ms linear`;
  timerBar.style.width = '0%';

  clearTimeout(timer);
  timer = setTimeout(()=>{
    if (!ended) {
      ended = true;
      alert('⏰ Time’s up!');
      endGame();
    }
  }, speeds[currentLevel]);
}

function handle(ans){
  if (ended) return;
  clearTimeout(timer);

  const q = gameQuestions[currentIndex];
  if (ans === q.correct) {
    // WRONG choice → lose heart
    hearts--; renderHearts();
    combo = 0;
    new Audio('sounds/heart.mp3').play();
    game.classList.add('shake');
    setTimeout(()=> game.classList.remove('shake'),400);
    if (hearts===0) return endGame();
  } else {
    // correct “wrong” → score
    const now = Date.now();
    combo = now - lastWrong < 800 ? combo + 1 : 1;
    lastWrong = now;
    const pts = Math.min(combo,5);
    score += pts;
    scoreDisp.textContent = `Score: ${score}`;
    new Audio('sounds/success.mp3').play();
    showCombo(pts);
    if (pts===5) sparkles();
    addXP(pts);
  }

  currentIndex++;
  nextQuestion();
}

function endToMenu(){
  clearTimeout(timer);
  game.style.display = 'none';
  menu.style.display = 'block';
}

// ─── HEARTS / XP / LEVEL UI ─────────────────────────────────────────────────────────
function renderHearts(){
  heartsEl.textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3-hearts);
}

function addXP(x){
  player.xp += x;
  let leveled = false;
  while (player.xp >= player.level*25){
    player.level++;
    leveled = true;
  }
  if (leveled){
    new Audio('sounds/level.mp3').play();
    alert(`🎉 Level Up! Lv ${player.level}`);
    confetti();
  }
  savePlayer();
  renderXP();
}

function renderXP(){
  document.getElementById('levelBadge').textContent = `Lv ${player.level}`;
  xpBar.style.width = `${(player.xp % 25)/25*100}%`;
}

// ─── END GAME & REGISTER MODAL ──────────────────────────────────────────────────────
const registerModal = document.getElementById('registerModal');
const finalScore    = document.getElementById('finalScoreText');
const nameInput     = document.getElementById('playerNameInput');
const registerBtn   = document.getElementById('registerScoreButton');

function endGame(){
  if (ended) return;
  ended = true;
  clearTimeout(timer);

  // update streak
  player.lastPlay = today();
  player.streak++;
  savePlayer();
  streakBadge.textContent = `🔥${player.streak}`;

  finalScore.textContent = `Your final score: ${score}`;
  registerModal.style.display = 'flex';
}

registerBtn.onclick = () => {
  // hide modal & back to menu
  registerModal.style.display = 'none';
  game.style.display = 'none';
  menu.style.display = 'block';
};

// ─── FUN ANIMATIONS ─────────────────────────────────────────────────────────────────
function showCombo(m){
  if (m<2) return;
  const d = document.createElement('div');
  d.className='comboPop'; d.textContent=`×${m}`;
  document.body.appendChild(d);
  setTimeout(()=> d.remove(),600);
}

function sparkles(){
  for(let i=0;i<15;i++){
    const s = document.createElement('div');
    s.className='sparkle';
    const ang = Math.random()*Math.PI*2, dist=60+Math.random()*40;
    s.style.setProperty('--dx',`${Math.cos(ang)*dist}px`);
    s.style.setProperty('--dy',`${Math.sin(ang)*dist}px`);
    document.body.appendChild(s);
    setTimeout(()=>s.remove(),700);
  }
}

function confetti(){
  ['#ff5b5b','#ffba5a','#4ecdc4','#ffd166'].forEach((c,i)=>{
    const e = document.createElement('div');
    e.className='confetti';
    e.style.setProperty('--dx',`${(Math.random()-0.5)*300}px`);
    e.style.setProperty('--dy',`${-Math.random()*300}px`);
    e.style.setProperty('--c',c);
    document.body.appendChild(e);
    setTimeout(()=>e.remove(),800);
  });
}

// ─── INITIAL UI STATE ────────────────────────────────────────────────────────────────
renderHearts();
renderXP();
