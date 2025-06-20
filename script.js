/******************************************************************************************
 WRONG CHOICE – Cloud Leaderboard Build
  • Global top-10 list is fetched from / posted to API_URL
  • Only today’s scores are shown (auto-reset at midnight UTC)
******************************************************************************************/

const API_URL = 'https://YOUR-WORKER-URL.workers.dev';   //  ←  CHANGE THIS

/* ╔═  GLOBAL STATE  ═══════════════════════════════════════════════════════════════════ */
let questions=[], gameQuestions=[];
let currentCategory="", currentLevel="Basic";
let currentIndex=0, score=0, timer=null;
const speeds={ Basic:7000, Hard:5000, Expert:3000 };
let combo=0, lastWrong=0, hearts=3, ended=false;

/* ╔═  PLAYER PROFILE (local)  ════════════════════════════════════════════════════════ */
const KEY='playerData', defaultData={xp:0,level:1,streak:0,lastPlay:'',theme:'light'};
const player={...defaultData,...JSON.parse(localStorage.getItem(KEY)||'{}')};
const today=()=>new Date().toISOString().slice(0,10); // YYYY-MM-DD
const savePlayer=()=>localStorage.setItem(KEY,JSON.stringify(player));

/* ╔═  SOUND FX  ═════════════════════════════════════════════════════════════════════ */
const ding=new Audio('sounds/success.mp3');
const buzz=new Audio('sounds/heart.mp3');
const chime=new Audio('sounds/level.mp3');

/* ╔═  DOM SHORTCUTS  ════════════════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const heartsEl=$('hearts'), streakBadge=$('streakBadge');
const menu=$('menu'), game=$('game'), levelName=$('levelName'), scoreDisp=$('scoreDisplay');
const qImg=$('questionImage'), qText=$('questionText'), timerBar=$('timerBar');
const xpBar=$('xpBar'), levelBadge=$('levelBadge'), darkBtn=$('darkToggle');

/* ╔═  THEME INIT  ═══════════════════════════════════════════════════════════════════ */
if(player.theme==='dark'){ document.body.classList.add('dark'); darkBtn.textContent='☀️'; }

/* ╔═  DAILY STREAK INIT  ════════════════════════════════════════════════════════════ */
if(player.lastPlay && new Date(today())-new Date(player.lastPlay)===86400000){ player.streak++; }
else if(player.lastPlay!==today()){ player.streak=0; }
streakBadge.textContent=`🔥${player.streak}`;
savePlayer();

/* ╔═  LOAD JSON (images + words)  ═══════════════════════════════════════════════════ */
Promise.all([
  fetch('images.json').then(r=>r.json()),
  fetch('dictionary.json').then(r=>r.json())
]).then(([imgs,dic])=>{
  const byCat={}; dic.words.forEach(({word,category})=>((byCat[category]=byCat[category]||[]).push(word)));
  const build=q=>{
      const subj=q.file.split('.')[0], cat=q.category, path=`images/${q.file}`;
      if(Math.random()<.7) return{img:path,text:`Is this ${subj}?`,correct:'yes',category:cat};
      const pool=(byCat[cat]||[]).filter(w=>w.toLowerCase()!==subj.toLowerCase());
      if(!pool.length){ console.warn(`⚠️  No words for ${cat}`); return null; }
      const wrong=pool[Math.random()*pool.length|0];
      return{img:path,text:`Is this ${wrong}?`,correct:'no',category:cat};
  };
  questions=imgs.images.map(build).filter(Boolean).sort(()=>Math.random()-.5);
  enableLevelButtons();
}).catch(console.error);

/* ╔═  CATEGORY & LEVEL PICKERS  ═════════════════════════════════════════════════════ */
function setCategory(cat){
  currentCategory=cat;
  document.querySelectorAll('.cat').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
  $('categorySelect').value=cat;
  renderLeaderboard();           // pull from cloud whenever user switches category
}
document.querySelectorAll('.cat').forEach(b=>b.onclick=()=>setCategory(b.dataset.cat));
$('categorySelect').onchange=e=>setCategory(e.target.value);

function enableLevelButtons(){ document.querySelectorAll('.level').forEach(b=>b.disabled=false); }
document.querySelectorAll('.level').forEach(b=>b.onclick=()=>{
  currentLevel=b.dataset.level;
  startGame();
});

/* ╔═  TOP ICON BUTTONS  ═════════════════════════════════════════════════════════════ */
$('howToPlayBtn').onclick=()=>$('howToPlayModal').style.display='flex';
$('closeHowToBtn').onclick=()=>$('howToPlayModal').style.display='none';
darkBtn.onclick=()=>{
  document.body.classList.toggle('dark');
  darkBtn.textContent=document.body.classList.contains('dark')?'☀️':'🌙';
  player.theme=document.body.classList.contains('dark')?'dark':'light'; savePlayer();
};

/* ╔═  GAME FLOW  ════════════════════════════════════════════════════════════════════ */
function startGame(){
  if(!currentCategory) return alert('Pick a category first!');
  gameQuestions=questions.filter(q=>q.category===currentCategory);
  if(!gameQuestions.length) return alert('Empty category.');

  ended=false; combo=0; hearts=3; score=0; currentIndex=0;
  renderHearts(); renderXP();
  menu.style.display='none'; game.style.display='block';
  levelName.textContent=`${currentCategory} — ${currentLevel}`; scoreDisp.textContent='Score: 0';
  nextQuestion();
}

function nextQuestion(){
  if(currentIndex>=gameQuestions.length) return endGame();
  const q=gameQuestions[currentIndex];
  qImg.src=q.img; qText.textContent=q.text;

  timerBar.style.transition='none'; timerBar.style.width='100%'; void timerBar.offsetWidth;
  timerBar.style.transition=`width ${speeds[currentLevel]}ms linear`;
  timerBar.style.width='0%';
  clearTimeout(timer);
  timer=setTimeout(()=>{ alert('Time up!'); endGame(); }, speeds[currentLevel]);
}

$('yesButton').onclick = ()=>handle('yes');
$('noButton').onclick  = ()=>handle('no');
$('backToMenu').onclick= endToMenu;

function handle(ans){
  if(ended) return;
  clearTimeout(timer);
  const q=gameQuestions[currentIndex];

  if(ans===q.correct){            // WRONG CHOICE mechanic – lose heart
    hearts--;renderHearts();combo=0;buzz.play();
    game.classList.add('shake');setTimeout(()=>game.classList.remove('shake'),400);
    if(hearts===0){ endGame(); return; }
  }else{                          // good “wrong” answer
    const now=Date.now(); combo=now-lastWrong<800?combo+1:1; lastWrong=now;
    const mult=Math.min(combo,5); score+=mult; scoreDisp.textContent=`Score: ${score}`;
    addXP(mult); ding.play(); showCombo(mult); if(mult===5) sparkles();
  }
  currentIndex++; nextQuestion();
}

/* ╔═  HEARTS / XP / LEVEL  ═════════════════════════════════════════════════════════ */
function renderHearts(){ heartsEl.textContent='❤️'.repeat(hearts)+'🤍'.repeat(3-hearts); }

function addXP(x){
  player.xp+=x; let up=false;
  while(player.xp>=player.level*25){ player.level++; up=true; }
  if(up){ confetti(); chime.play(); alert(`Level Up! Lv ${player.level}`); }
  savePlayer(); renderXP();
}
function renderXP(){
  levelBadge.textContent=`Lv ${player.level}`;
  xpBar.style.width=`${(player.xp%25)/25*100}%`;
}

/* ╔═  GAME ENDING / CLOUD SAVE  ════════════════════════════════════════════════════ */
function endGame(){
  if(ended) return; ended=true;
  clearTimeout(timer);

  // local streak
  player.lastPlay=today(); player.streak++; savePlayer(); streakBadge.textContent=`🔥${player.streak}`;

  $('finalScoreText').textContent=`Your final score: ${score}`;
  $('registerModal').style.display='flex';
}

function endToMenu(){ clearTimeout(timer); game.style.display='none'; menu.style.display='block'; }

/* ╔═  REGISTER SCORE  (POST to cloud, then refresh board)  ═════════════════════════ */
$('registerScoreButton').onclick=async ()=>{
  const name=$('playerNameInput').value.trim()||'Anon';
  try{
    await fetch(`${API_URL}?cat=${encodeURIComponent(currentCategory)}&lvl=${currentLevel}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,score})
    });
  }catch(e){ console.error('API fail',e); }

  $('registerModal').style.display='none';
  game.style.display='none'; menu.style.display='block';
  renderLeaderboard();             // pull fresh data
};

/* ╔═  GLOBAL LEADERBOARD RENDER  ═══════════════════════════════════════════════════ */
async function renderLeaderboard(){
  if(!currentCategory) return;
  const levels=['Basic','Hard','Expert'];
  for(const lvl of levels){
    const box=$(`leaderboard${lvl}`);
    box.querySelector('.leaderboardContent').innerHTML='Loading…';
    try{
      const rows=await fetch(`${API_URL}?cat=${encodeURIComponent(currentCategory)}&lvl=${lvl}&date=${today()}`)
                       .then(r=>r.json());
      let html='<table><thead><tr><th>#</th><th>Name</th><th>Score</th></tr></thead><tbody>';
      if(!rows.length) html+='<tr><td colspan="3">No scores yet today.</td></tr>';
      else rows.forEach((r,i)=>{ html+=`<tr><td>${i+1}</td><td>${r.name}</td><td>${r.score}</td></tr>`;});
      html+='</tbody></table>';
      box.querySelector('.leaderboardContent').innerHTML=html;
    }catch(e){
      box.querySelector('.leaderboardContent').innerHTML='<small>offline</small>';
      console.error(e);
    }
  }
}

/* ╔═  COMBO POP / SPARKLE / CONFETTI  ═════════════════════════════════════════════ */
function showCombo(m){
  if(m<2) return;
  const d=document.createElement('div'); d.className='comboPop'; d.textContent=`×${m}`;
  document.body.appendChild(d); setTimeout(()=>d.remove(),600);
}
function sparkles(){
  for(let i=0;i<15;i++){
    const s=document.createElement('div'); s.className='sparkle';
    const ang=Math.random()*6.28, dist=60+Math.random()*40;
    s.style.setProperty('--dx',`${Math.cos(ang)*dist}px`);
    s.style.setProperty('--dy',`${Math.sin(ang)*dist}px`);
    document.body.appendChild(s); setTimeout(()=>s.remove(),700);
  }
}
function confetti(){
  const colors=['#ff5b5b','#ffba5a','#4ecdc4','#ffd166'];
  for(let i=0;i<25;i++){
    const c=document.createElement('div'); c.className='confetti';
    c.style.setProperty('--dx',`${(Math.random()-.5)*300}px`);
    c.style.setProperty('--dy',`${-Math.random()*300}px`);
    c.style.setProperty('--c',colors[i%colors.length]);
    document.body.appendChild(c); setTimeout(()=>c.remove(),800);
  }
}

/* ╔═  SOCIAL SHARE (unchanged)  ═══════════════════════════════════════════════════ */
$('shareXButton').onclick=()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('I scored '+score+' in Wrong Choice!')}`);
$('shareFacebookButton').onclick=()=>window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`);
function shareNative(){
  if(navigator.share) navigator.share({title:'Wrong Choice',text:`I scored ${score}!`});
  else alert('Native share not supported.');
}
$('shareScore').onclick=shareNative;

/* ╔═  INITIAL PAINT  ═══════════════════════════════════════════════════════════════ */
renderXP(); renderLeaderboard();
