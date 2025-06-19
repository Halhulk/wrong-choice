/******************************************************************************************
 WRONG CHOICE – Complete Game + Persistent Cloud/Local Leaderboard
******************************************************************************************/
const API_URL = 'https://YOUR-WORKER-URL.workers.dev'; // ← update this to your Worker URL

// ╔═ GLOBALS ═══════════════════════════════════════════════════════════════════════════
let combo     = 0;
let lastWrong = 0;
let hearts    = 3;
let ended     = false;

let questions       = [];
let gameQuestions   = [];
let currentCategory = '';
let currentLevel    = 'Basic';
let currentIndex    = 0;
let score           = 0;
let timer           = null;

let playerName   = '';
let currentScore = 0;

// ╔═ PLAYER PROFILE ════════════════════════════════════════════════════════════════════
const KEY         = 'playerData';
const defaultData = { xp:0, level:1, streak:0, lastPlay:'', theme:'light' };
const player      = { ...defaultData, ...JSON.parse(localStorage.getItem(KEY)||'{}') };

const today = ()=> new Date().toISOString().slice(0,10);
const savePlayer = ()=> localStorage.setItem(KEY, JSON.stringify(player));

// ╔═ SPEEDS PER LEVEL ═════════════════════════════════════════════════════════════════
const speeds = { Basic:7000, Hard:5000, Expert:3000 };

// ╔═ AUDIO ═════════════════════════════════════════════════════════════════════════════
const ding  = new Audio('sounds/success.mp3');
const buzz  = new Audio('sounds/heart.mp3');
const chime = new Audio('sounds/level.mp3');

// ╔═ DOM HELPERS & CACHING ══════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

// main UI elements
const menu         = $('menu');
const game         = $('game');
const levelName    = $('levelName');
const scoreDisp    = $('scoreDisplay');
const heartsEl     = $('hearts');
const xpBar        = $('xpBar');
const levelBadge   = $('levelBadge');
const streakBadge  = $('streakBadge');
const darkBtn      = $('darkToggle');
const howToPlayBtn = $('howToPlayBtn');
const howToModal   = $('howToPlayModal');
const closeHowTo   = $('closeHowToBtn');

const qImg         = $('questionImage');
const qText        = $('questionText');
const timerBar     = $('timerBar');
const yesBtn       = $('yesButton');
const noBtn        = $('noButton');
const backBtn      = $('backToMenu');
const registerModal= $('registerModal');
const registerBtn  = $('registerScoreButton');
const nameInput    = $('playerNameInput');
const finalScore   = $('finalScoreText');

// ╔═ INIT THEME & STREAK ══════════════════════════════════════════════════════════════
if (player.theme==='dark') {
  document.body.classList.add('dark');
  darkBtn.textContent='☀️';
}
darkBtn.onclick = () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  darkBtn.textContent = isDark?'☀️':'🌙';
  player.theme = isDark?'dark':'light';
  savePlayer();
};

if (player.lastPlay===today()) {
  // same day, do nothing
} else if (player.lastPlay && (new Date(today()) - new Date(player.lastPlay)===86400000)) {
  player.streak++;
} else {
  player.streak=0;
}
player.lastPlay = today();
streakBadge.textContent = `🔥${player.streak}`;
savePlayer();

// ╔═ LOAD QUESTIONS + DICTIONARY ════════════════════════════════════════════════════════
Promise.all([
  fetch('images.json').then(r=>r.json()),
  fetch('dictionary.json').then(r=>r.json())
]).then(([imgs, dic])=>{
  const byCat = {};
  dic.words.forEach(({word,category})=>{
    (byCat[category]=byCat[category]||[]).push(word);
  });
  questions = imgs.images.map(({file,category})=>{
    const subj = file.split('.')[0],
          path = `images/${file}`,
          makeYes = Math.random()<0.7;
    if (makeYes) {
      return {img:path,text:`Is this ${subj}?`,correct:'yes',category};
    }
    const pool = (byCat[category]||[]).filter(w=>w.toLowerCase()!==subj.toLowerCase());
    if (!pool.length) return null;
    const wrong = pool[Math.floor(Math.random()*pool.length)];
    return {img:path,text:`Is this ${wrong}?`,correct:'no',category};
  }).filter(Boolean).sort(()=>Math.random()-.5);

  // enable categories and levels now
  document.querySelectorAll('.cat').forEach(b=>{
    b.onclick = ()=> setCategory(b.dataset.cat);
    b.classList.remove('active'); // reset
  });
  $('categorySelect').onchange = e=> setCategory(e.target.value);

  document.querySelectorAll('.level').forEach(b=>{
    b.disabled = false;
    b.onclick = ()=>{
      currentLevel = b.dataset.level;
      startGame();
    };
  });
}).catch(console.error);

// ╔═ CATEGORY PICK & BOARD RENDER ════════════════════════════════════════════════════
function setCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.cat')
    .forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  $('categorySelect').value = cat;
  renderLeaderboard();
}

// ╔═ START GAME ═══════════════════════════════════════════════════════════════════════
function startGame(){
  if (!currentCategory) return alert('Pick a category first!');
  gameQuestions = questions.filter(q=>q.category===currentCategory);
  if (!gameQuestions.length)  return alert('Empty category.');

  // reset state
  combo     = 0;
  lastWrong = 0;
  hearts    = 3;
  ended     = false;
  score     = 0;
  currentIndex=0;
  renderHearts(); renderXP();

  menu.style.display = 'none';
  game.style.display = 'block';
  levelName.textContent = `${currentCategory} — ${currentLevel}`;
  scoreDisp.textContent = 'Score: 0';

  // bind game buttons
  yesBtn.onclick = ()=> handle('yes');
  noBtn.onclick  = ()=> handle('no');
  backBtn.onclick= endToMenu;

  nextQuestion();
}

// ╔═ QUESTION LOOP ════════════════════════════════════════════════════════════════════
function nextQuestion(){
  if (currentIndex >= gameQuestions.length) return endGame();
  const q = gameQuestions[currentIndex];
  qImg.src = q.img;
  qText.textContent = q.text;

  timerBar.style.transition='none';
  timerBar.style.width='100%';
  void timerBar.offsetWidth;
  timerBar.style.transition=`width ${speeds[currentLevel]}ms linear`;
  timerBar.style.width='0%';

  clearTimeout(timer);
  timer = setTimeout(()=>{ alert('Time up!'); endGame(); }, speeds[currentLevel]);
}

function handle(ans){
  if (ended) return;
  clearTimeout(timer);
  const q = gameQuestions[currentIndex];
  if (ans===q.correct){
    // wrong choice → lose heart
    hearts--; renderHearts(); combo=0; buzz.play();
    game.classList.add('shake');
    setTimeout(()=>game.classList.remove('shake'),400);
    if (hearts===0) return endGame();
  } else {
    // correct “wrong” → earn combo points
    const now = Date.now();
    combo = (now - lastWrong<800)? combo+1 : 1;
    lastWrong = now;
    const m = Math.min(combo,5);
    score+=m;
    scoreDisp.textContent=`Score: ${score}`;
    addXP(m); ding.play(); showCombo(m);
    if (m===5) sparkles();
  }
  currentIndex++;
  nextQuestion();
}

// ╔═ HEARTS / XP / LEVEL UI ══════════════════════════════════════════════════════════
function renderHearts(){
  heartsEl.textContent = '❤️'.repeat(hearts)+'🤍'.repeat(3-hearts);
}
function addXP(x){
  player.xp+=x;
  let up=false;
  while (player.xp >= player.level*25){
    player.level++; up=true;
  }
  if (up){
    confetti(); chime.play();
    alert(`Level Up! Lv ${player.level}`);
  }
  savePlayer(); renderXP();
}
function renderXP(){
  levelBadge.textContent=`Lv ${player.level}`;
  xpBar.style.width = `${((player.xp%25)/25)*100}%`;
}

// ╔═ END GAME & SHOW REGISTER MODAL ══════════════════════════════════════════════════
function endGame(){
  if (ended) return;
  ended = true;
  clearTimeout(timer);
  player.lastPlay = today(); player.streak++; savePlayer();
  streakBadge.textContent = `🔥${player.streak}`;
  finalScore.textContent = `Your final score: ${score}`;
  registerModal.style.display = 'flex';
}
function endToMenu(){
  clearTimeout(timer);
  game.style.display = 'none';
  menu.style.display = 'block';
}

// ╔═ LOCALSTORAGE HELPERS FOR LEADERBOARD ═══════════════════════════════════════════
function storageKey(cat,lvl){ return `lb:${cat}:${lvl}`; }
function readStored(cat,lvl){
  try{ return JSON.parse(localStorage.getItem(storageKey(cat,lvl)))||[]; }
  catch{return [];}
}
function writeStored(cat,lvl,arr){
  localStorage.setItem(storageKey(cat,lvl), JSON.stringify(arr.slice(0,10)));
}

// ╔═ DUMMY DATA ══════════════════════════════════════════════════════════════════════
function generateDummyScores(){
  const names = ["Z","M","A","B","E","D","A2","K","B2","A3","A4","L","H","P"];
  const out = [];
  for(let i=0;i<9;i++){
    out.push({name: names[Math.floor(Math.random()*names.length)],
              score: Math.floor(Math.random()*6)+5});
  }
  if (playerName && typeof currentScore==='number'){
    out.push({name:playerName,score:currentScore});
  }
  return out.sort((a,b)=>b.score-b.score).slice(0,10);
}

// ╔═ CLOUD FETCH + FALLBACK RENDER ════════════════════════════════════════════════════
async function fetchLeaderboard(cat,lvl){
  const url = `${API_URL}?cat=${encodeURIComponent(cat)}&lvl=${encodeURIComponent(lvl)}`;
  console.log('→ fetching leaderboard',url);
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error(r.status);
    const d = await r.json();
    console.log(`← got ${d.length} for ${lvl}`,d);
    return d.sort((a,b)=>b.score-a.score);
  } catch(e){
    console.warn('API failed',lvl,e);
    return null;
  }
}

async function renderLeaderboard(){
  if(!currentCategory) return;
  const lvls = ['Basic','Hard','Expert'];
  lvls.forEach(async lvl=>{
    let scores = await fetchLeaderboard(currentCategory,lvl);
    if(!Array.isArray(scores)||!scores.length){
      scores = readStored(currentCategory,lvl);
    }
    if(!scores.length){
      scores = generateDummyScores();
    }
    writeStored(currentCategory,lvl,scores);

    const rows = scores.slice(0,10).map((r,i)=>{
      const you = (r.name===playerName && r.score===currentScore)? ' class="you"' : '';
      return `<tr${you}><td>${i+1}</td><td>${r.name}</td><td>${r.score}</td></tr>`;
    }).join('');

    const box = $(`leaderboard${lvl}`);
    box.querySelector('.leaderboardContent').innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Score</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  });
}

// ╔═ REGISTER SCORE BUTTON ════════════════════════════════════════════════════════════
registerBtn.onclick = async ()=>{
  const name = nameInput.value.trim()||'Anon';
  playerName   = name;
  currentScore = score;

  // persist local
  const stored = readStored(currentCategory,currentLevel);
  stored.push({name,score:currentScore});
  writeStored(currentCategory,currentLevel,stored);

  // post to cloud
  try{
    await fetch(
      `${API_URL}?cat=${encodeURIComponent(currentCategory)}&lvl=${currentLevel}`,
      {method:'POST',headers:{'Content-Type':'application/json'},
       body: JSON.stringify({name,score:currentScore})});
  }catch(e){ console.error('post fail',e); }

  registerModal.style.display='none';
  game.style.display='none';
  menu.style.display='block';
  renderLeaderboard();
};

// ╔═ COMBO / SPARKLE / CONFETTI FUN ═══════════════════════════════════════════════════
function showCombo(m){
  if(m<2) return;
  const d = document.createElement('div');
  d.className='comboPop'; d.textContent=`×${m}`;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(),600);
}
function sparkles(){
  for(let i=0;i<15;i++){
    const s=document.createElement('div'); s.className='sparkle';
    const ang=Math.random()*Math.PI*2, dist=60+Math.random()*40;
    s.style.setProperty('--dx',`${Math.cos(ang)*dist}px`);
    s.style.setProperty('--dy',`${Math.sin(ang)*dist}px`);
    document.body.appendChild(s);
    setTimeout(()=>s.remove(),700);
  }
}
function confetti(){
  ['#ff5b5b','#ffba5a','#4ecdc4','#ffd166'].forEach((c,i)=>{
    const el = document.createElement('div');
    el.className='confetti';
    el.style.setProperty('--dx',`${(Math.random()-0.5)*300}px`);
    el.style.setProperty('--dy',`${-Math.random()*300}px`);
    el.style.setProperty('--c',c);
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),800);
  });
}

// ╔═ SOCIAL SHARE BUTTONS ════════════════════════════════════════════════════════════
$('shareXButton').onclick = ()=> window.open(
  `https://twitter.com/intent/tweet?text=${encodeURIComponent('I scored '+score+' in Wrong Choice!')}`);
$('shareFacebookButton').onclick = ()=> window.open(
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`);
$('shareScore').onclick = ()=> {
  if(navigator.share) navigator.share({title:'Wrong Choice',text:`I scored ${score}!`});
  else alert('Native share not supported.');
};

// ╔═ INITIALIZE UI ═══════════════════════════════════════════════════════════════════
renderXP();
renderLeaderboard();
