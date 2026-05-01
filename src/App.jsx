import { useState, useCallback, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

const db = getFirestore(initializeApp({
  apiKey: "AIzaSyDwr_jHSbTIjqhy-pPmwSg0_PIWFl4VbDs",
  authDomain: "mahjong-fightclub-scoremgmt.firebaseapp.com",
  projectId: "mahjong-fightclub-scoremgmt",
  storageBucket: "mahjong-fightclub-scoremgmt.firebasestorage.app",
  messagingSenderId: "62509991153",
  appId: "1:62509991153:web:e843eec7e295e1ed235550",
}));
const DATA_DOC = doc(db, "mahjong", "shared");
const saveData = (data) => setDoc(DATA_DOC, data).catch(e => console.error("保存エラー:", e));

const MODES = { FOUR:"4", THREE:"3" };
const DEFAULT_SETTINGS = {
  "4":{ mode:"4", label:"四麻", playerCount:4, startPoints:25000, returnPoints:30000, uma:[10,5,-5,-10] },
  "3":{ mode:"3", label:"三麻", playerCount:3, startPoints:35000, returnPoints:40000, uma:[20,0,-20] },
};
const VIEWS = { HOME:"home", SETUP:"setup", GAME:"game", RESULT:"result", HISTORY:"history", EDIT:"edit", STATS:"stats", SCORES:"scores", SETTINGS:"settings", SETTLEMENT:"settlement" };
const PLAYER_COLORS = [
  { bg:"rgba(179,136,255,0.25)", color:"#b388ff" },
  { bg:"rgba(100,160,240,0.25)", color:"#64a0f0" },
  { bg:"rgba(120,210,170,0.25)", color:"#78d2aa" },
  { bg:"rgba(230,100,140,0.25)", color:"#e6648c" },
];
const MEMBER_LIST = ["居石","小笠原","齋藤（肇）","齋藤（蓮）","関根","長谷川","遠藤","畑福","藤原","田村","長谷目（弘）","長谷目（大）","江口"];
const TABLE_COLORS = [
  { color:"#b388ff", border:"rgba(179,136,255,0.4)" },
  { color:"#64a0f0", border:"rgba(100,160,240,0.4)" },
  { color:"#78d2aa", border:"rgba(120,210,170,0.4)" },
  { color:"#e6648c", border:"rgba(230,100,140,0.4)" },
];
const GRAPH_COLORS = [
  "#ff4d4d","#ff9933","#ffdd00","#66cc44","#00cc88","#00cccc",
  "#0099ff","#6655ff","#cc44cc","#ff44aa","#aaaaaa","#ffffff",
];
const GRAPH_SHAPES = ["circle","square","triangle","diamond"];
const RANK_MEDALS = ["🥇","🥈","🥉"];
const WINDS = ["東","南","西","北"];
const RANK_CLASSES = ["r1","r2","r3","r4"];

function calcFinalScores(players, settings) {
  const oka = (settings.returnPoints - settings.startPoints) * settings.playerCount;
  const ranked = [...players].map((p,i)=>({...p,origIdx:i,rawPoints:p.points})).sort((a,b)=>b.points-a.points||a.origIdx-b.origIdx);
  ranked[0].points += oka;
  const results = ranked.map((p,rank)=>{
    // 五捨六入：(素点 - 返し点) ÷ 1000、端数は0.5未満切捨て・0.6以上切上げ
    const rawExact = (p.points - settings.returnPoints) / 1000;
    const raw = Math.floor(rawExact + 0.4);
    const uma = settings.uma[rank];
    const total = raw + uma;
    // 三麻は÷2（端数切り捨て、1着は残差で上書きされる）
    const finalTotal = settings.playerCount === 3 ? Math.floor(total / 2) : total;
    return { ...p, rank:rank+1, rawPoints:p.rawPoints, raw, uma, total:finalTotal };
  });
  // ゼロサム補正：合計のズレ（五捨六入の誤差）を1着に加算
  if(settings.playerCount === 3) {
    // 三麻：残差で1着を確定
    const othersSum = results.slice(1).reduce((s,r)=>s+r.total, 0);
    results[0].total = -othersSum;
  } else {
    // 四麻：誤差（通常0か±1）を1着に加算
    const sum = results.reduce((s,r)=>s+r.total, 0);
    results[0].total -= sum;
  }
  return results;
}
function genId() { return Math.random().toString(36).slice(2,9); }
function formatPt(n, w=false) {
  if (n==null) return "-";
  const s = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
  return w&&n>0 ? `+${s}` : s;
}
function buildYearData(games, year, excludeManual=false) {
  const yg = games.filter(g=>new Date(g.date).getFullYear()===year && (!excludeManual || !g.manual));
  const map = {};
  yg.forEach(g=>g.results.forEach(r=>{
    if(!map[r.name]) map[r.name]={name:r.name,games:0,totalScore:0,wins:0,top2:0,ranks:[],bestRawPoints:0,last4:0};
    const p=map[r.name];
    p.games++; p.totalScore+=r.total; p.ranks.push(r.rank);
    if(r.rank===1) p.wins++;
    if(r.rank<=2) p.top2++;
    if(r.rank===g.results.length) p.last4++;
    if((r.rawPoints||r.points||0) > p.bestRawPoints) p.bestRawPoints = r.rawPoints||r.points||0;
  }));
  return { yearGames:yg, playerMap:map };
}
function YearSelector({ year, setYear, games }) {
  const years = [...new Set(games.map(g=>new Date(g.date).getFullYear()))];
  const min = years.length ? Math.min(...years) : year;
  const max = years.length ? Math.max(...years) : year;
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
      <button className="annual-year-btn" disabled={year<=min} onClick={()=>setYear(y=>y-1)}>‹</button>
      <span className="annual-year-label">{year}年</span>
      <button className="annual-year-btn" disabled={year>=max} onClick={()=>setYear(y=>y+1)}>›</button>
    </div>
  );
}

const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0e0b14;--surface:#1a1525;--surface2:#231c32;--border:#362a4a;--accent:#b388ff;--accent2:#d0aaff;--red:#e05c7a;--blue:#7c9ee0;--green:#7cc8a0;--text:#ede8f8;--muted:#8878a8;--radius:12px;--font:'Meiryo UI','メイリオ',Meiryo,sans-serif}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font)}
#root{min-height:100vh;display:flex;flex-direction:column;width:100%;max-width:480px;margin:0 auto;position:relative}
h1,h2,h3{font-family:var(--font)}
.app-header{background:linear-gradient(135deg,#1a1525 0%,#0e0b14 100%);border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.app-header h1{font-size:18px;font-weight:900;letter-spacing:2px;color:var(--accent)}
.back-btn{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;padding:4px 8px}
.action-btn{background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;font-family:inherit;font-weight:700;letter-spacing:1px}
.screen{flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;padding-bottom:80px}
.bottom-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:var(--surface);border-top:1px solid var(--border);display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom)}
.nav-btn{flex:1;padding:12px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;border-top:2px solid transparent;cursor:pointer;color:var(--muted);font-family:inherit;font-size:10px;letter-spacing:.5px;transition:all .15s}
.nav-btn.active{color:var(--accent);border-top-color:var(--accent);background:rgba(179,136,255,.07)}
.nav-btn.active .icon{transform:scale(1.15)}
.nav-btn:active{transform:scale(.9);opacity:.7}
.nav-btn .icon{font-size:20px;transition:transform .15s}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.card-title{font-size:11px;letter-spacing:2px;color:var(--muted);font-weight:700;margin-bottom:12px;text-transform:uppercase}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:700;letter-spacing:1px;transition:all .15s;padding:14px 20px}
.btn-primary{background:linear-gradient(135deg,#7c3aed,#b388ff);color:#fff;font-size:15px;width:100%}
.btn-primary:active{transform:scale(.95);filter:brightness(1.2);box-shadow:0 0 20px rgba(179,136,255,.6)}
.btn-secondary{background:var(--surface2);color:var(--text);font-size:14px;border:1px solid var(--border)}
.btn-secondary:active{transform:scale(.95);background:var(--border)}
.btn-danger{background:rgba(224,92,92,.15);color:var(--red);font-size:13px;border:1px solid rgba(224,92,92,.3)}
.btn-danger:active{transform:scale(.95);background:rgba(224,92,92,.3)}
.btn-sm{padding:8px 14px;font-size:12px;border-radius:8px}
.btn-icon{padding:8px;border-radius:8px;width:36px;height:36px}
.btn-icon:active{transform:scale(.9)}
.mode-tabs{display:flex;gap:8px}
.mode-tab{flex:1;padding:10px;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--muted);cursor:pointer;font-family:var(--font);font-weight:700;font-size:16px;text-align:center;transition:all .15s}
.mode-tab.active{border-color:var(--accent);color:var(--accent);background:rgba(179,136,255,.1)}
.mode-tab:active{transform:scale(.95);background:rgba(179,136,255,.15)}
.player-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.player-row:last-child{border-bottom:none}
.player-badge{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0}
.player-input{flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:inherit;font-size:15px;padding:8px 12px;outline:none}
.player-input:focus{border-color:var(--accent)}
.score-grid{display:flex;flex-direction:column;gap:10px}
.score-row{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px}
.score-row.top{border-color:var(--accent);background:rgba(179,136,255,.06)}
.score-name{flex:1;font-weight:700;font-size:15px}
.score-pts{font-size:22px;font-weight:900;min-width:80px;text-align:right}
.score-input-field{background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:20px;font-weight:700;padding:6px 10px;width:110px;text-align:right;outline:none}
.score-input-field:focus{border-color:var(--accent)}
.result-row{display:flex;align-items:center;gap:12px;padding:14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)}
.result-row.rank1{border-color:var(--accent);background:rgba(179,136,255,.08)}
.rank-num{font-size:28px;font-weight:900;min-width:36px;text-align:center}
.rank-num.r1{color:var(--accent)}.rank-num.r2{color:#aaa}.rank-num.r3{color:#c87}.rank-num.r4{color:var(--muted)}
.result-name{flex:1;font-weight:700;font-size:15px}
.result-detail{text-align:right}
.result-total{font-size:22px;font-weight:900}
.result-total.pos{color:var(--green)}.result-total.neg{color:var(--red)}
.result-breakdown{font-size:11px;color:var(--muted);margin-top:2px}
.history-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:10px}
.history-header{padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px}
.history-body{padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.history-player-row{display:flex;align-items:center;gap:8px;font-size:13px}
.history-rank{font-weight:900;min-width:20px;text-align:center}
.history-pname{flex:1;min-width:0}
.history-rawpts{font-size:12px;color:var(--muted);min-width:72px;text-align:right}
.history-score{font-weight:700;min-width:52px;text-align:right}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:10px}
.stat-header{padding:10px 14px;background:var(--surface2);border-bottom:1px solid var(--border);font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px}
.stat-body{padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.stat-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;border-bottom:1px solid var(--border);padding-bottom:6px}
.stat-row:last-child{border-bottom:none;padding-bottom:0}
.stat-val{font-weight:700;font-size:16px}
.stat-val.pos{color:var(--green)}.stat-val.neg{color:var(--red)}
.setting-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.setting-row:last-child{border-bottom:none}
.setting-label{font-size:14px}
.setting-input{background:var(--surface2);border:2px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--font);font-size:18px;font-weight:700;padding:10px 12px;width:110px;text-align:right;outline:none;transition:border-color .15s}
.setting-input:focus{border-color:var(--accent);background:rgba(179,136,255,.05)}
.hero{position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(160deg,#1a0a2e 0%,#0e0b14 40%,#0a0a1e 100%);border:1px solid rgba(179,136,255,.3);padding:28px 20px 22px;text-align:center}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 50% 0%,rgba(124,58,237,.18) 0%,transparent 70%),radial-gradient(ellipse 80% 60% at 50% 100%,rgba(100,60,180,.08) 0%,transparent 70%);pointer-events:none}
.hero-main-row{display:flex;align-items:flex-end;justify-content:center;gap:14px;position:relative;z-index:1}
.hero-text-block{text-align:left}
.hero-line2{display:flex;align-items:flex-end;gap:0;margin-top:3px}
.hero-word-normal{font-size:26px;font-weight:900;color:var(--accent);letter-spacing:2px;text-shadow:0 0 20px rgba(179,136,255,.5);line-height:1}
.hero-word-fight{display:inline-flex;flex-direction:column;align-items:center;gap:0;margin:0 1px;justify-content:flex-end}
.hero-furigana{font-size:10px;color:var(--accent2);letter-spacing:3px;font-weight:700;line-height:1;margin-bottom:2px}
.hero-kanji{font-size:26px;font-weight:900;color:var(--accent);letter-spacing:2px;text-shadow:0 0 20px rgba(179,136,255,.5);line-height:1}
.annual-ranking{display:flex;flex-direction:column;gap:6px}
.annual-row{display:flex;align-items:center;gap:10px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);padding:10px 12px}
.annual-row.rank1{border-color:rgba(179,136,255,.5);background:rgba(179,136,255,.07)}
.annual-row.rank2{border-color:rgba(180,180,180,.3)}
.annual-row.rank3{border-color:rgba(180,120,220,.3)}
.annual-rank-num{font-weight:900;font-size:20px;min-width:28px;text-align:center}
.annual-rank-num.r1{color:var(--accent)}.annual-rank-num.r2{color:#c0b0e0}.annual-rank-num.r3{color:#a080cc}.annual-rank-num.rn{color:var(--muted);font-size:15px}
.annual-name{flex:1;font-weight:700;font-size:15px}
.annual-games{font-size:11px;color:var(--muted)}
.annual-score{font-size:20px;font-weight:900;min-width:64px;text-align:right}
.annual-score.pos{color:var(--green)}.annual-score.neg{color:var(--red)}.annual-score.zero{color:var(--muted)}
.annual-year-label{font-size:18px;font-weight:900;color:var(--accent)}
.annual-year-btn{background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;font-size:18px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;transition:all .12s}
.annual-year-btn:active{transform:scale(.88);background:var(--accent);color:#fff;border-color:var(--accent)}
.annual-year-btn:disabled{opacity:.3;cursor:default}
.chip{display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--muted)}
.chip.mode4{border-color:var(--blue);color:var(--blue);background:rgba(92,158,224,.08)}
.chip.mode3{border-color:var(--green);color:var(--green);background:rgba(92,200,122,.08)}
.empty-state{text-align:center;padding:40px 20px;color:var(--muted);font-size:14px}
.empty-icon{font-size:40px;margin-bottom:12px}
.total-bar{display:flex;justify-content:space-between;align-items:center;background:rgba(179,136,255,.08);border:1px solid var(--accent);border-radius:8px;padding:8px 14px;margin-top:4px}
.total-bar-label{font-size:12px;color:var(--accent);font-weight:700;letter-spacing:1px}
.total-bar-val{font-size:18px;font-weight:900}
.total-bar-val.ok{color:var(--green)}.total-bar-val.ng{color:var(--red)}
.uma-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.uma-item{display:flex;flex-direction:column;gap:4px}
.uma-item label{font-size:11px;color:var(--muted);letter-spacing:1px}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
input[type=number]{-moz-appearance:textfield}
.animate-in{animation:fadeUp .25s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:flex-end;justify-content:center}
.modal-sheet{background:var(--surface);border-radius:16px 16px 0 0;padding:24px 20px 40px;padding-bottom:calc(40px + env(safe-area-inset-bottom));width:100%;max-width:480px;display:flex;flex-direction:column;gap:12px}
.modal-title{font-size:18px;font-weight:900;margin-bottom:4px}
.modal-sub{font-size:13px;color:var(--muted);margin-bottom:8px}
`;

const selectStyle = {
  background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8,
  color:"var(--text)", fontFamily:"inherit", fontSize:15, padding:"8px 12px",
  width:"100%", outline:"none", appearance:"none", WebkitAppearance:"none",
  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888898' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center",
};

export default function App() {
  const [data, setData] = useState({ games:[], settings:DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(VIEWS.HOME);
  const [tables, setTables] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingGame, setEditingGame] = useState(null);
  const [modal, setModal] = useState(null);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [scoresYear, setScoresYear] = useState(new Date().getFullYear());
  const [scrollTarget, setScrollTarget] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(DATA_DOC, snap => {
      setData(snap.exists() ? snap.data() : { games:[], settings:DEFAULT_SETTINGS });
      setLoading(false);
    }, err => { console.error("同期エラー:", err); setLoading(false); });
    return () => unsub();
  }, []);

  const persist = useCallback(d => { setData(d); saveData(d); }, []);
  const gs = tables[activeIdx] || null;
  const goHome = () => { setView(VIEWS.HOME); setTables([]); setActiveIdx(0); };

  const startGames = configs => {
    setTables(configs.map(({mode,players}) => {
      const s = data.settings[mode];
      return { id:genId(), mode, settings:s, players:players.map((name,i)=>({id:i,name,points:s.startPoints})), startedAt:new Date().toISOString() };
    }));
    setActiveIdx(0); setView(VIEWS.GAME);
  };

  const finishGame = g => {
    const results = calcFinalScores(g.players, g.settings);
    persist({ ...data, games:[{ id:g.id, mode:g.mode, date:new Date().toISOString(), settings:g.settings, results, memo:g.memo||"" }, ...data.games] });
    setTables(prev => prev.map((t,i) => i===activeIdx ? {...t,finalResults:results} : t));
    setView(VIEWS.RESULT);
  };

  const deleteAllGames = () => { persist({ ...data, games:[] }); setModal(null); };
  const deleteGame = id => { persist({ ...data, games:data.games.filter(g=>g.id!==id) }); setModal(null); };
  const addManualGame = (entry) => { persist({ ...data, games:[entry, ...data.games] }); };
  const updateManualGame = (ug) => { persist({ ...data, games:data.games.map(g=>g.id===ug.id?ug:g) }); };
  const updateGame = ug => { persist({ ...data, games:data.games.map(g=>g.id===ug.id?ug:g) }); setEditingGame(null); setView(VIEWS.HISTORY); };
  const saveSettings = s => persist({ ...data, settings:s });
  const recalcAllGames = () => {
    const updated = data.games.map(g => {
      const players = [...g.results].sort((a,b)=>a.origIdx-b.origIdx).map(r=>({id:r.origIdx,name:r.name,points:r.rawPoints}));
      const results = calcFinalScores(players, g.settings);
      return { ...g, results };
    });
    persist({ ...data, games:updated });
  };

  const exportData = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mahjong-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmFinish = () => {
    setModal({ title:"対局を終了しますか？", sub:"現在の点数で集計します", confirmLabel:"終了して集計", onConfirm:()=>{ setModal(null); finishGame(gs); } });
  };

  const Header = ({title, backFn, rightEl}) => (
    <div className="app-header">
      {backFn ? <button className="back-btn" onClick={backFn}>‹</button> : <div style={{width:40}}/>}
      <h1>{title}</h1>
      {rightEl || <div style={{width:40}}/>}
    </div>
  );

  if (loading) return (
    <><style>{css}</style>
      <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,color:"var(--accent)",fontFamily:"var(--font)"}}>
        <div style={{fontSize:48}}>🀄</div>
        <div style={{fontSize:16,letterSpacing:2}}>読み込み中...</div>
      </div>
    </>
  );

  return (
    <><style>{css}</style>
      {modal && (
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{modal.title}</div>
            <div className="modal-sub">{modal.sub}</div>
            <button className="btn btn-danger" onClick={modal.onConfirm}>{modal.confirmLabel}</button>
            <button className="btn btn-secondary" onClick={()=>setModal(null)}>キャンセル</button>
          </div>
        </div>
      )}
      <div id="root">
        {view===VIEWS.HOME && <HomeScreen onStart={()=>setView(VIEWS.SETUP)} games={data.games} onPlayerTap={name=>{setScoresYear(new Date().getFullYear());setScrollTarget(name);setView(VIEWS.SCORES);}}/>}
        {view===VIEWS.SETUP && (<><Header title="新規対局" backFn={goHome}/><SetupScreen settings={data.settings} onStart={startGames}/></>)}
        {view===VIEWS.GAME && gs && (
          <>
            <Header title={tables.length>1?`${activeIdx+1}卓目 対局中`:"対局中"} backFn={confirmFinish} rightEl={<button className="action-btn" onClick={confirmFinish}>終了</button>}/>
            {tables.length>1 && (
              <div style={{display:"flex",gap:6,padding:"8px 16px 0",background:"var(--surface)",borderBottom:"1px solid var(--border)"}}>
                {tables.map((t,i) => (
                  <button key={i} onClick={()=>{setActiveIdx(i);setView(VIEWS.GAME);}}
                    style={{flex:1,padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
                      background:i===activeIdx?"var(--accent)":"var(--surface2)",
                      color:i===activeIdx?"#0f0f14":t.finalResults?"var(--green)":"var(--muted)"}}>
                    {i+1}卓{t.finalResults?" ✓":""}
                  </button>
                ))}
              </div>
            )}
            <GameScreen gs={gs} onFinish={finishGame}/>
          </>
        )}
        {view===VIEWS.RESULT && gs?.finalResults && (
          <><Header title={`${tables.length>1?`${activeIdx+1}卓目 `:""}結果`} backFn={tables.length>1?()=>setView(VIEWS.GAME):goHome}/>
            <ResultScreen gs={gs} onHome={goHome} tables={tables} activeIdx={activeIdx} setActiveIdx={setActiveIdx} setView={setView}/></>
        )}
        {view===VIEWS.EDIT && editingGame && (
          <><Header title="履歴を編集" backFn={()=>{setEditingGame(null);setView(VIEWS.HISTORY);}}/>
            <EditGameScreen game={editingGame} onSave={updateGame} onCancel={()=>{setEditingGame(null);setView(VIEWS.HISTORY);}}/></>
        )}
        {view===VIEWS.HISTORY && (
          <HistoryScreen games={data.games}
            onEdit={g=>{setEditingGame(g);setView(VIEWS.EDIT);}}
            onDelete={id=>setModal({title:"この対局を削除しますか？",sub:"削除すると元に戻せません",confirmLabel:"削除する",onConfirm:()=>deleteGame(id)})}/>
        )}
        {view===VIEWS.STATS && <StatsScreen games={data.games} year={statsYear} setYear={setStatsYear}/>}
        {view===VIEWS.SCORES && <ScoresScreen games={data.games} year={scoresYear} setYear={setScoresYear} scrollTarget={scrollTarget} clearScrollTarget={()=>setScrollTarget(null)}/>}
        {view===VIEWS.SETTLEMENT && <SettlementScreen games={data.games}/>}
        {view===VIEWS.SETTINGS && <SettingsScreen settings={data.settings} onSave={saveSettings} onRecalc={()=>setModal({title:"全履歴を再計算しますか？",sub:"保存済みの全対局（四麻・三麻）のスコアを現在のロジックで再計算します。この操作は元に戻せません。",confirmLabel:"再計算する",onConfirm:()=>{setModal(null);recalcAllGames();}})} onExport={exportData} onDeleteAll={()=>setModal({title:"全履歴を削除しますか？",sub:"プレーヤーリストは残ります。この操作は元に戻せません。",confirmLabel:"全て削除する",onConfirm:deleteAllGames})} onAddManual={addManualGame} onUpdateManual={updateManualGame} manualGames={data.games.filter(g=>g.manual)}/>}
        {[VIEWS.HOME,VIEWS.HISTORY,VIEWS.STATS,VIEWS.SCORES,VIEWS.SETTLEMENT,VIEWS.SETTINGS].includes(view) && (
          <nav className="bottom-nav">
            {[{v:VIEWS.HOME,icon:"🀄",label:"成績"},{v:VIEWS.STATS,icon:"📈",label:"推移"},{v:VIEWS.SCORES,icon:"📊",label:"統計"},{v:VIEWS.HISTORY,icon:"📋",label:"履歴"},{v:VIEWS.SETTLEMENT,icon:"¥",label:"精算"},{v:VIEWS.SETTINGS,icon:"⚙️",label:"設定"}]
              .map(({v,icon,label}) => (
                <button key={v} className={`nav-btn ${view===v?"active":""}`} onClick={()=>setView(v)}>
                  <span className="icon">{icon}</span>{label}
                </button>
              ))}
          </nav>
        )}
      </div>
    </>
  );
}

function HomeScreen({ onStart, games, onPlayerTap }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { yearGames, playerMap } = buildYearData(games, year);
  const ranking = Object.values(playerMap)
    .sort((a,b)=>b.totalScore-a.totalScore||b.wins-a.wins)
    .map(p=>({...p, avg:Math.round((p.totalScore/p.games)*10)/10}));
  return (
    <div className="screen animate-in" style={{gap:14}}>
      <div className="hero">
        <div className="hero-main-row">
          <span style={{fontSize:24,filter:"drop-shadow(0 0 6px rgba(179,136,255,0.5))",flexShrink:0,lineHeight:1}}>🀄</span>
          <div className="hero-text-block">
            <div className="hero-line2">
              <span className="hero-word-normal">麻雀</span>
              <span className="hero-word-fight">
                <span className="hero-furigana">ファイト</span>
                <span className="hero-kanji">格闘</span>
              </span>
              <span className="hero-word-normal">倶楽部</span>
            </div>
          </div>
          <span style={{fontSize:24,filter:"drop-shadow(0 0 6px rgba(232,200,122,0.5))",flexShrink:0,lineHeight:1}}>🏆</span>
        </div>
      </div>
      <button className="btn btn-primary" style={{fontSize:17,padding:17,letterSpacing:2}} onClick={onStart}>＋ 新規対局を開始</button>
      <div className="card">
        <YearSelector year={year} setYear={setYear} games={games}/>
        {ranking.length===0
          ? <div style={{textAlign:"center",padding:"20px 0",color:"var(--muted)",fontSize:13}}>{year}年の対局データがありません</div>
          : <>
            <div style={{fontSize:12,color:"var(--muted)",textAlign:"right",marginBottom:8}}>
              年間対局数：<span style={{fontWeight:700,color:"var(--accent2)"}}>{yearGames.length}</span>回
            </div>
            <div className="annual-ranking">
              {ranking.map((p,i)=>(
                <div key={p.name} className={`annual-row ${i===0?"rank1":i===1?"rank2":i===2?"rank3":""}`}
                  onClick={()=>onPlayerTap(p.name)}
                  style={{cursor:"pointer",transition:"opacity 0.15s"}}
                  onPointerDown={e=>e.currentTarget.style.opacity="0.6"}
                  onPointerUp={e=>e.currentTarget.style.opacity="1"}
                  onPointerLeave={e=>e.currentTarget.style.opacity="1"}>
                  <span className={`annual-rank-num ${i===0?"r1":i===1?"r2":i===2?"r3":"rn"}`}>{i<3?RANK_MEDALS[i]:`${i+1}`}</span>
                  <div style={{flex:1}}>
                    <div className="annual-name">{p.name}</div>
                    <div className="annual-games">{p.games}戦 / 平均{formatPt(p.avg,true)}</div>
                  </div>
                  <span className={`annual-score ${p.totalScore>0?"pos":p.totalScore<0?"neg":"zero"}`}>{formatPt(p.totalScore,true)}</span>
                  <span style={{fontSize:14,color:"var(--muted)",marginLeft:6,alignSelf:"center"}}>›</span>
                </div>
              ))}
            </div>
          </>
        }
      </div>
    </div>
  );
}

function TableSetup({ tableIdx, mode, setMode, players, setPlayers, usedNames, settings }) {
  const cnt = mode===MODES.FOUR?4:3;
  const s = settings[mode];
  const setPlayer = (i,val) => setPlayers(prev=>{const n=[...prev];n[i]=val;return n;});
  const getOptions = si => {
    const others = players.filter((_,i)=>i!==si);
    return MEMBER_LIST.filter(m=>!others.includes(m)&&!usedNames.includes(m));
  };
  return (
    <div className="card" style={{borderColor:TABLE_COLORS[tableIdx]?.border||"var(--border)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div className="card-title" style={{margin:0,color:TABLE_COLORS[tableIdx]?.color||"var(--muted)"}}>{tableIdx+1}卓目</div>
        <div className="mode-tabs" style={{gap:6}}>
          <button className={`mode-tab ${mode===MODES.FOUR?"active":""}`} style={{padding:"5px 12px",fontSize:13}}
            onClick={()=>{setMode(MODES.FOUR);setPlayers(["","","",""]);}}>四麻</button>
          <button className={`mode-tab ${mode===MODES.THREE?"active":""}`} style={{padding:"5px 12px",fontSize:13}}
            onClick={()=>{setMode(MODES.THREE);setPlayers(["","",""]);}}>三麻</button>
        </div>
      </div>
      {Array.from({length:cnt}).map((_,i)=>(
        <div key={i} className="player-row" style={{paddingTop:8,paddingBottom:8}}>
          <div className="player-badge" style={{background:PLAYER_COLORS[i].bg,color:PLAYER_COLORS[i].color,flexShrink:0}}>{WINDS[i]}</div>
          <select style={selectStyle} value={players[i]||""} onChange={e=>setPlayer(i,e.target.value)}>
            <option value="">― 選択 ―</option>
            {players[i]&&<option value={players[i]}>{players[i]}</option>}
            {getOptions(i).filter(m=>m!==players[i]).map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      ))}
      <div style={{marginTop:8,fontSize:12,color:"var(--muted)"}}>
        💰 {s.startPoints.toLocaleString()}点持ち・{s.returnPoints.toLocaleString()}点返し　
        📈 ウマ: {s.uma.map((u,i)=>`${i+1}着${u>0?"+":""}${u}`).join(" / ")}
      </div>
    </div>
  );
}

function SetupScreen({ settings, onStart }) {
  const [mode, setMode] = useState(MODES.FOUR);
  const [players, setPlayers] = useState(["","","",""]);
  const cnt = mode===MODES.FOUR?4:3;
  const canStart = players.slice(0,cnt).every(p=>p!=="");
  const handleStart = () => onStart([{mode, players:players.slice(0,cnt)}]);
  return (
    <div className="screen animate-in">
      <TableSetup tableIdx={0} mode={mode} setMode={m=>{setMode(m);setPlayers(["","","",""]);}}
        players={players} setPlayers={setPlayers} usedNames={[]} settings={settings}/>
      <button className="btn btn-primary" onClick={handleStart} disabled={!canStart} style={{opacity:canStart?1:0.5}}>
        対局開始
      </button>
      {!canStart&&<div style={{textAlign:"center",fontSize:12,color:"var(--muted)",marginTop:-8}}>全プレイヤーを選択してください</div>}
    </div>
  );
}

function GameScreen({ gs, onFinish }) {
  // 1000点単位で入力（例: 38600点 → 38.6と入力）
  const [tmp, setTmp] = useState(gs.players.map(p=>String(p.points/1000)));
  const [memo, setMemo] = useState(gs.memo||"");

  const parsedTmp = tmp.map(v=>(parseFloat(String(v).replace(/,/g,""))||0)*1000);
  const total = parsedTmp.reduce((s,v)=>s+v,0);
  const expected = gs.settings.startPoints * gs.settings.playerCount;
  const diff = total - expected;

  const sorted = [...parsedTmp.map((pts,i)=>({...gs.players[i],points:pts}))].sort((a,b)=>b.points-a.points);

  const handleFinish = () => {
    if(diff !== 0) return;
    onFinish({...gs, memo, players: gs.players.map((p,i)=>({...p,points:parsedTmp[i]}))});
  };

  return (
    <div className="screen animate-in">
      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div className="card-title" style={{margin:0}}>素点入力</div>
          <div style={{fontSize:11,color:"var(--muted)"}}>※ 小数点以下1桁まで（×1000点）</div>
        </div>
        <div className="score-grid">
          {gs.players.map((p,i)=>{
            const rank=sorted.findIndex(s=>s.id===p.id)+1;
            return (
              <div key={p.id} className={`score-row ${rank===1?"top":""}`}>
                <div className="player-badge" style={{background:PLAYER_COLORS[i].bg,color:PLAYER_COLORS[i].color,width:28,height:28,fontSize:11}}>{rank}位</div>
                <span className="score-name">{p.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <input className="score-input-field" type="number" step="0.1" value={tmp[i]}
                    onFocus={e=>e.target.select()}
                    onChange={e=>{const t=[...tmp];t[i]=e.target.value;setTmp(t);}}
                    style={{width:80,textAlign:"right"}}/>
                  <span style={{fontSize:13,color:"var(--muted)",fontWeight:700}}>× 1000</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="total-bar" style={{marginTop:12}}>
          <span className="total-bar-label">合計</span>
          <span className={`total-bar-val ${diff===0?"ok":"ng"}`}>{total.toLocaleString()}点</span>
        </div>
        {diff!==0&&(
          <div style={{marginTop:6,textAlign:"right",fontSize:13,color:"var(--muted)"}}>
            あと <b style={{color:"var(--accent2)"}}>{(-diff).toLocaleString()}点</b>
          </div>
        )}
      </div>

      <div style={{background:"var(--surface)",border:"1px solid rgba(179,136,255,.3)",borderRadius:"var(--radius)",padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{fontSize:15}}>📝</span>
          <span style={{fontSize:12,fontWeight:700,color:"var(--accent)",letterSpacing:1}}>思い出</span>
          <span style={{fontSize:11,color:"var(--muted)"}}>役満など特別な出来事を記録</span>
        </div>
        <textarea
          value={memo}
          onChange={e=>setMemo(e.target.value)}
          placeholder="例：居石さんが国士無双をツモ！"
          rows={2}
          style={{width:"100%",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:8,
            color:"var(--text)",fontFamily:"inherit",fontSize:13,padding:"8px 10px",
            outline:"none",resize:"none",lineHeight:1.6,boxSizing:"border-box"}}/>
      </div>

      <button className="btn btn-primary"
        style={{background: diff===0 ? "linear-gradient(135deg,#6d28d9,#a855f7)" : "var(--surface2)",
                color: diff===0 ? "#fff" : "var(--muted)",
                cursor: "pointer",
                opacity: diff===0 ? 1 : 0.7}}
        onClick={handleFinish}>
        {diff===0 ? "🏁 終了・集計" : `⚠ 合計が合いません（${diff>0?"+":""}${diff}）`}
      </button>
    </div>
  );
}

function ResultScreen({ gs, onHome, tables, activeIdx, setActiveIdx, setView }) {
  const results = gs.finalResults;
  const others = tables.filter((_,i)=>i!==activeIdx);
  return (
    <div className="screen animate-in">
      <div className="card">
        <div className="card-title">最終結果 — {gs.mode===MODES.FOUR?"四麻":"三麻"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {results.map((r,i)=>(
            <div key={r.origIdx} className={`result-row ${r.rank===1?"rank1":""}`} style={{alignItems:"flex-start"}}>
              <span className={`rank-num ${RANK_CLASSES[i]}`} style={{paddingTop:4}}>{r.rank}</span>
              <div className="player-badge" style={{background:PLAYER_COLORS[r.origIdx].bg,color:PLAYER_COLORS[r.origIdx].color,width:30,height:30,fontSize:11,marginTop:4,flexShrink:0}}>{WINDS[r.origIdx]}</div>
              <div style={{flex:1}}>
                <div className="result-name" style={{marginBottom:6}}>{r.name}</div>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)"}}>
                    <span>素点</span>
                    <span>{r.rawPoints.toLocaleString()}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)"}}>
                    <span>{(gs.settings.returnPoints/1000).toFixed(0)}千点返し</span>
                    <span style={{color:r.raw>=0?"var(--green)":"var(--red)"}}>{formatPt(r.raw,true)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted)"}}>
                    <span>ウマ</span>
                    <span style={{color:r.uma>0?"var(--green)":r.uma<0?"var(--red)":"var(--muted)"}}>{r.uma>0?"+":""}{r.uma}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:900,borderTop:`1px solid var(--border)`,marginTop:3,paddingTop:4}}>
                    <span style={{color:"var(--muted)"}}>合計</span>
                    <span style={{color:r.total>=0?"var(--green)":"var(--red)"}}>{formatPt(r.total,true)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {gs.memo&&(
        <div style={{background:"var(--surface)",border:"1px solid rgba(179,136,255,.3)",borderRadius:"var(--radius)",padding:"10px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:15}}>📝</span>
            <span style={{fontSize:12,fontWeight:700,color:"var(--accent)",letterSpacing:1}}>思い出</span>
          </div>
          <div style={{fontSize:13,color:"var(--text)",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{gs.memo}</div>
        </div>
      )}
      {others.length>0&&(
        <div className="card">
          <div className="card-title">他の卓</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {others.map(t=>{
              const idx=tables.indexOf(t);
              return (
                <button key={t.id} className="btn btn-secondary" style={{justifyContent:"space-between",padding:"10px 14px"}}
                  onClick={()=>{setActiveIdx(idx);setView(t.finalResults?VIEWS.RESULT:VIEWS.GAME);}}>
                  <span style={{fontWeight:700}}>{idx+1}卓目</span>
                  <span style={{fontSize:12,color:t.finalResults?"var(--green)":"var(--accent)"}}>{t.finalResults?"✓ 終了済み":"▶ 対局中"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button className="btn btn-primary" onClick={onHome}>ホームへ戻る</button>
    </div>
  );
}

function HistoryScreen({ games, onEdit, onDelete }) {
  const filtered = games.filter(g=>!g.manual);
  if(filtered.length===0) return (
    <div className="screen animate-in"><div className="empty-state"><div className="empty-icon">📋</div>対局履歴はまだありません</div></div>
  );
  return (
    <div className="screen animate-in">
      {filtered.map(g=>(
        <div key={g.id} className="history-card">
          <div className="history-header">
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span className={`chip ${g.mode===MODES.FOUR?"mode4":"mode3"}`}>{g.mode===MODES.FOUR?"四麻":"三麻"}</span>
              <span>{new Date(g.date).toLocaleDateString("ja-JP",{month:"short",day:"numeric"})}</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="btn btn-secondary btn-sm btn-icon" style={{width:30,height:30,fontSize:14}} onClick={()=>onEdit(g)}>✏</button>
              <button className="btn btn-danger btn-sm btn-icon" style={{width:30,height:30}} onClick={()=>onDelete(g.id)}>✕</button>
            </div>
          </div>
          <div className="history-body">
            {g.results.map((r,i)=>(
              <div key={i} className="history-player-row">
                <span className="history-rank" style={{color:["var(--accent)","#aaa","#c87","var(--muted)"][i]}}>{r.rank}</span>
                <span className="history-pname">{r.name}</span>
                <span className="history-rawpts">{(r.rawPoints||0).toLocaleString()}点</span>
                <span className="history-score" style={{color:r.total>=0?"var(--green)":"var(--red)"}}>{formatPt(r.total,true)}</span>
              </div>
            ))}
            {g.memo&&(
              <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid var(--border)",display:"flex",alignItems:"flex-start",gap:5}}>
                <span style={{fontSize:12}}>📝</span>
                <span style={{fontSize:12,color:"var(--accent2)",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{g.memo}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditGameScreen({ game, onSave, onCancel }) {
  const sorted = [...game.results].sort((a,b)=>a.origIdx-b.origIdx);
  const [names, setNames] = useState(sorted.map(r=>r.name));
  // 1000点単位で入力（例: 38600点 → 38.6と入力）
  const [rawPoints, setRawPoints] = useState(sorted.map(r=>String((r.rawPoints||0)/1000)));
  const [date, setDate] = useState(game.date.slice(0,10));
  const { settings:s } = game;
  const pc = s.playerCount;
  // 1000倍して実際の点数に戻す
  const parsed = rawPoints.map(v=>(parseFloat(v.replace(/,/g,""))||0)*1000);
  const total = parsed.reduce((a,b)=>a+b,0);
  const exp = s.startPoints*pc;
  const diff = total-exp;
  const preview = calcFinalScores(names.map((name,i)=>({id:i,name,points:parsed[i]})), s);
  return (
    <div className="screen animate-in">
      <div className="card">
        <div className="card-title">対局日</div>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:15,padding:"8px 12px",width:"100%",outline:"none"}}/>
      </div>
      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div className="card-title" style={{margin:0}}>点数・名前を編集</div>
          <div style={{fontSize:11,color:"var(--muted)"}}>※ 小数点以下1桁まで（×1000点）</div>
        </div>
        <div className="score-grid">
          {Array.from({length:pc}).map((_,i)=>(
            <div key={i} className="score-row">
              <div className="player-badge" style={{background:PLAYER_COLORS[i].bg,color:PLAYER_COLORS[i].color,width:28,height:28,fontSize:11}}>{WINDS[i]}</div>
              <input className="player-input" value={names[i]} style={{flex:1,fontSize:14,padding:"5px 10px"}}
                onChange={e=>{const n=[...names];n[i]=e.target.value;setNames(n);}}/>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <input className="score-input-field" type="number" step="0.1" value={rawPoints[i]} onFocus={e=>e.target.select()}
                  onChange={e=>{const p=[...rawPoints];p[i]=e.target.value;setRawPoints(p);}}
                  style={{width:80,textAlign:"right"}}/>
                <span style={{fontSize:13,color:"var(--muted)",fontWeight:700}}>× 1000</span>
              </div>
            </div>
          ))}
        </div>
        <div className="total-bar" style={{marginTop:12}}>
          <span className="total-bar-label">合計点</span>
          <span className={`total-bar-val ${diff===0?"ok":"ng"}`}>
            {total.toLocaleString()} {diff!==0&&<span style={{fontSize:13}}>({diff>0?"+":""}{diff})</span>}
          </span>
        </div>
        {diff!==0&&<div style={{fontSize:12,color:"var(--red)",marginTop:6,textAlign:"center"}}>⚠ 合計が{exp.toLocaleString()}点と一致していません</div>}
      </div>
      <div className="card">
        <div className="card-title">プレビュー（再計算結果）</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {preview.map((r,i)=>(
            <div key={r.origIdx} className={`result-row ${r.rank===1?"rank1":""}`} style={{padding:"10px 12px"}}>
              <span className={`rank-num ${RANK_CLASSES[i]}`} style={{fontSize:22}}>{r.rank}</span>
              <span className="result-name" style={{fontSize:14}}>{r.name}</span>
              <div className="result-detail">
                <div className={`result-total ${r.total>=0?"pos":"neg"}`} style={{fontSize:18}}>{formatPt(r.total,true)}</div>
                <div className="result-breakdown">{(r.rawPoints||0).toLocaleString()}点 / ウマ{r.uma>=0?"+":""}{r.uma}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" onClick={()=>onSave({...game,date:new Date(date).toISOString(),results:preview})}>✓ 保存する</button>
      <button className="btn btn-secondary" onClick={onCancel}>キャンセル</button>
    </div>
  );
}

function ScoresScreen({ games, year, setYear, scrollTarget, clearScrollTarget }) {
  const { yearGames, playerMap } = buildYearData(games, year, true);
  const players = Object.values(playerMap).map(p=>({
    ...p,
    avg:        Math.round((p.totalScore/p.games)*10)/10,
    winRate:    Math.round((p.wins/p.games)*100),
    renRate:    Math.round((p.top2/p.games)*100),
    avgRank:    Math.round((p.ranks.reduce((a,b)=>a+b,0)/p.ranks.length)*100)/100,
    avoidRate:  Math.round(((p.games-p.last4)/p.games)*100),
  })).sort((a,b)=>b.totalScore-a.totalScore);

  useEffect(()=>{
    if(!scrollTarget) return;
    const id = `score-player-${scrollTarget}`;
    const el = document.getElementById(id);
    if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); }
    clearScrollTarget();
  },[scrollTarget]);

  return (
    <div className="screen animate-in">
      <YearSelector year={year} setYear={setYear} games={games}/>
      {yearGames.length===0
        ? <div className="empty-state"><div className="empty-icon">🏆</div>{year}年のデータがありません</div>
        : <>
          <div style={{fontSize:12,color:"var(--muted)",textAlign:"right"}}>{year}年 全{yearGames.length}対局</div>
          {players.map((p,i)=>(
            <div key={p.name} id={`score-player-${p.name}`} className="stat-card" style={{transition:"box-shadow 0.4s",boxShadow:scrollTarget===p.name?"0 0 0 2px var(--accent)":"none"}}>
              <div className="stat-header">
                {i<3?<span>{RANK_MEDALS[i]}</span>:<span style={{color:"var(--muted)",fontSize:13}}>{i+1}位</span>}
                {p.name}<span style={{marginLeft:"auto",fontSize:13,color:"var(--muted)"}}>{p.games}戦</span>
              </div>
              <div className="stat-body">
                {[
                  ["トータルスコア", formatPt(p.totalScore,true), p.totalScore>=0?"pos":"neg"],
                  ["平均スコア",     formatPt(p.avg,true),        p.avg>=0?"pos":"neg"],
                  ["平均順位",       p.avgRank,                   ""],
                  ["トップ獲得回数", `${p.wins}回`,               ""],
                  ["トップ獲得率",   `${p.winRate}%`,             ""],
                ].map(([l,v,c])=>(
                  <div key={l} className="stat-row"><span>{l}</span><span className={`stat-val ${c}`}>{v}</span></div>
                ))}
                <div className="stat-row">
                  <span>連帯率 <span style={{fontSize:10,color:"var(--muted)"}}>（1・2位）</span></span>
                  <span className="stat-val" style={{color:p.renRate>=50?"var(--accent)":"var(--text)"}}>{p.renRate}%</span>
                </div>
                <div className="stat-row">
                  <span>ラス回避率</span>
                  <span className="stat-val" style={{color:p.avoidRate>=75?"var(--green)":p.avoidRate<50?"var(--red)":"var(--text)"}}>{p.avoidRate}%</span>
                </div>
                <div className="stat-row">
                  <span>最高素点</span>
                  <span className="stat-val" style={{color:"var(--accent2)"}}>{p.bestRawPoints.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </>
      }
    </div>
  );
}

function GraphDot({ shape, cx, cy, r=5, fill }) {
  switch(shape) {
    case "square":
      return <rect x={cx-r*.85} y={cy-r*.85} width={r*1.7} height={r*1.7} rx="1.5" fill={fill} stroke="var(--bg)" strokeWidth="1.5"/>;
    case "triangle":
      return <polygon points={`${cx},${cy-r} ${cx+r*.9},${cy+r*.65} ${cx-r*.9},${cy+r*.65}`} fill={fill} stroke="var(--bg)" strokeWidth="1.5"/>;
    case "diamond":
      return <polygon points={`${cx},${cy-r} ${cx+r},${cy} ${cx},${cy+r} ${cx-r},${cy}`} fill={fill} stroke="var(--bg)" strokeWidth="1.5"/>;
    default:
      return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="var(--bg)" strokeWidth="1.5"/>;
  }
}

function ShapeIcon({ shape, color, size=7 }) {
  const s = size;
  switch(shape) {
    case "square":
      return <svg width={s*2} height={s*2} style={{flexShrink:0}}><rect x={s*.15} y={s*.15} width={s*1.7} height={s*1.7} rx="1.2" fill={color} stroke="var(--bg)" strokeWidth="1.2"/></svg>;
    case "triangle":
      return <svg width={s*2} height={s*2} style={{flexShrink:0}}><polygon points={`${s},${s*.1} ${s*1.9},${s*1.9} ${s*.1},${s*1.9}`} fill={color} stroke="var(--bg)" strokeWidth="1.2"/></svg>;
    case "diamond":
      return <svg width={s*2} height={s*2} style={{flexShrink:0}}><polygon points={`${s},${s*.1} ${s*1.9},${s} ${s},${s*1.9} ${s*.1},${s}`} fill={color} stroke="var(--bg)" strokeWidth="1.2"/></svg>;
    default:
      return <svg width={s*2} height={s*2} style={{flexShrink:0}}><circle cx={s} cy={s} r={s*.75} fill={color} stroke="var(--bg)" strokeWidth="1.2"/></svg>;
  }
}

function StatsScreen({ games, year, setYear }) {
  const [activePlayer, setActivePlayer] = useState(null);
  const yearGames = games.filter(g=>new Date(g.date).getFullYear()===year).sort((a,b)=>new Date(a.date)-new Date(b.date));

  const playerMap = {};
  yearGames.forEach(g=>g.results.forEach(r=>{
    if(!playerMap[r.name]) playerMap[r.name]={name:r.name,cumScore:0,entries:[],games:0};
    const p=playerMap[r.name];
    p.cumScore+=r.total; p.games++;
    p.entries.push({gameIdx:yearGames.indexOf(g),cumScore:p.cumScore});
  }));

  // MEMBER_LIST の順番で色・形状を固定割り当て（対局がない回があっても色がズレない）
  const players = Object.values(playerMap).map(p=>{
    const mi = MEMBER_LIST.indexOf(p.name);
    const ci = mi >= 0 ? mi : 0;
    return {
      ...p,
      color: GRAPH_COLORS[ci % GRAPH_COLORS.length],
      shape: GRAPH_SHAPES[ci % GRAPH_SHAPES.length],
      totalScore: p.cumScore,
      cumScores: yearGames.map((_,gi)=>{const e=p.entries.find(e=>e.gameIdx===gi);return e?e.cumScore:null;}),
    };
  }).sort((a,b)=>b.totalScore-a.totalScore);

  const allScores = players.flatMap(p=>p.cumScores.filter(v=>v!==null));
  const scoreMin = Math.min(0,...allScores||[0]);
  const scoreMax = Math.max(0,...allScores||[0]);

  if(yearGames.length===0) return (
    <div className="screen animate-in">
      <YearSelector year={year} setYear={setYear} games={games}/>
      <div className="empty-state"><div className="empty-icon">📊</div>{year}年のデータがありません</div>
    </div>
  );

  const PAD_TOP=12, PAD_BTM=28, H=800, PLOT_H=H-PAD_TOP-PAD_BTM;
  const range=scoreMax-scoreMin||1;
  const step=Math.max(1,Math.ceil((range/4)/10)*10);
  const yStart=Math.floor(scoreMin/step)*step;
  const yGrids=[]; for(let v=yStart;v<=scoreMax+step;v+=step) yGrids.push(v);
  const toY=v=>PAD_TOP+PLOT_H-((v-scoreMin)/range)*PLOT_H;
  const n=yearGames.length;
  const COL_W=Math.max(48,300/n);
  const W=COL_W*(n-1||1);
  const toX=i=>i*COL_W;

  return (
    <div className="screen animate-in">
      <YearSelector year={year} setYear={setYear} games={games}/>
      <div className="card" style={{padding:0,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"var(--font)"}}>
          <thead>
            <tr style={{background:"var(--surface2)",borderBottom:"1px solid var(--border)"}}>
              <th style={{padding:"8px 10px",textAlign:"left",color:"var(--muted)",fontWeight:700,fontSize:11,whiteSpace:"nowrap",position:"sticky",left:0,width:120,minWidth:120,background:"var(--surface2)",zIndex:2}}>順位　プレイヤー</th>
              <th style={{padding:"8px 6px",textAlign:"center",color:"var(--accent)",fontWeight:700,fontSize:11,whiteSpace:"nowrap",minWidth:48,width:52,position:"sticky",left:120,background:"var(--surface2)",zIndex:2,borderRight:"1px solid var(--border)"}}>総合</th>
              {yearGames.map((g,i)=>{const d=new Date(g.date);return <th key={i} style={{padding:"4px 6px",textAlign:"center",color:"var(--muted)",fontWeight:700,fontSize:11,whiteSpace:"nowrap",minWidth:48}}><div style={{fontSize:10,color:"var(--accent)"}}>{`第${i+1}回`}</div><div>{`${d.getMonth()+1}/${d.getDate()}`}</div></th>;})}
            </tr>
          </thead>
          <tbody>
            {players.map((p,pi)=>(
              <tr key={p.name} style={{borderBottom:"1px solid var(--border)",background:pi%2===0?"transparent":"rgba(255,255,255,0.02)"}}>
                <td style={{padding:"8px 10px",fontWeight:700,whiteSpace:"nowrap",position:"sticky",left:0,width:120,minWidth:120,background:pi%2===0?"var(--surface)":"#1e1830",zIndex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,fontWeight:900,color:["var(--accent)","#aaa","#c87","var(--muted)"][pi]??'var(--muted)',minWidth:14,textAlign:"right"}}>{pi+1}</span>
                    <ShapeIcon shape={p.shape} color={p.color} size={6}/>
                    <span style={{textAlign:"left"}}>{p.name}</span>
                  </div>
                </td>
                <td style={{padding:"8px 6px",textAlign:"center",fontWeight:900,fontSize:13,color:p.totalScore>0?"var(--green)":p.totalScore<0?"var(--red)":"var(--muted)",position:"sticky",left:120,background:pi%2===0?"var(--surface)":"#1e1830",zIndex:1,borderRight:"1px solid var(--border)"}}>
                  {formatPt(p.totalScore,true)}
                </td>
                {yearGames.map((g,gi)=>{
                  const r=g.results.find(r=>r.name===p.name);
                  return <td key={gi} style={{padding:"8px 6px",textAlign:"center",fontWeight:700,color:r?(r.total>0?"var(--green)":r.total<0?"var(--red)":"var(--muted)"):"var(--border)"}}>{r?formatPt(r.total,true):"—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-title">累計スコア推移</div>
        <div style={{display:"flex"}}>
          <svg width="44" height={H} style={{flexShrink:0}}>
            <line x1="43" y1={PAD_TOP} x2="43" y2={H-PAD_BTM} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
            {yGrids.map((v,i)=>{
              const y=toY(v);
              if(y<PAD_TOP-4||y>H-PAD_BTM+4) return null;
              return <g key={i}>
                <line x1="38" y1={y} x2="43" y2={y} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                <text x="36" y={y+4} textAnchor="end" fontSize="9" fill={v===0?"rgba(255,255,255,0.5)":"var(--muted)"} fontFamily="var(--font)">{v>=0?`+${v}`:v}</text>
              </g>;
            })}
          </svg>
          <div style={{overflowX:"auto",flex:1}}>
            <svg width={W+12} height={H} style={{display:"block",minWidth:"100%"}}>
              {yGrids.map((v,i)=>{const y=toY(v);if(y<PAD_TOP-4||y>H-PAD_BTM+4)return null;return <line key={i} x1={0} y1={y} x2={W+12} y2={y} stroke={v===0?"rgba(255,255,255,0.25)":"rgba(255,255,255,0.07)"} strokeWidth={v===0?1.2:1} strokeDasharray={v===0?"4,3":"2,4"}/>;})}
              {yearGames.map((_,i)=><line key={i} x1={toX(i)} y1={PAD_TOP} x2={toX(i)} y2={H-PAD_BTM} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>)}
              {yearGames.map((_,i)=><text key={i} x={toX(i)} y={H-10} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--font)">{`第${i+1}回`}</text>)}
              <line x1={0} y1={H-PAD_BTM} x2={W+12} y2={H-PAD_BTM} stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
              {players.map(p=>{
                const pts=p.cumScores.map((v,i)=>v!==null?{x:toX(i),y:toY(v),v}:null).filter(Boolean);
                const isFocus=activePlayer===p.name;
                const isActive=!activePlayer||isFocus;
                return (
                  <g key={p.name} opacity={isActive?1:0.1} style={{transition:"opacity 0.2s"}}>
                    {pts.length>1&&<polyline points={pts.map(pt=>`${pt.x},${pt.y}`).join(" ")} fill="none" stroke={p.color} strokeWidth={isFocus?2.5:1.5} strokeLinejoin="round" strokeLinecap="round"/>}
                    {pts.map((pt,i)=>(
                      <g key={i}>
                        <GraphDot shape={p.shape} cx={pt.x} cy={pt.y} r={5} fill={p.color}/>
                        {isFocus&&<text x={pt.x} y={pt.y-10} textAnchor="middle" fontSize="9" fill={p.color} fontFamily="var(--font)" fontWeight="700">{pt.v>=0?`+${Number(pt.v).toFixed(1)}`:Number(pt.v).toFixed(1)}</text>}
                      </g>
                    ))}
                    {isFocus&&pts.length>0&&(
                      <text x={pts[pts.length-1].x+8} y={pts[pts.length-1].y+4} fontSize="10" fill={p.color} fontFamily="var(--font)" fontWeight="900">{p.name}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"5px 10px",marginTop:10}}>
          <button onClick={()=>setActivePlayer(null)}
            style={{display:"flex",alignItems:"center",gap:5,border:`1px solid ${activePlayer===null?"rgba(255,255,255,.4)":"transparent"}`,cursor:"pointer",padding:"3px 7px",borderRadius:6,background:activePlayer===null?"rgba(255,255,255,.1)":"transparent",transition:"all 0.15s"}}>
            <span style={{fontSize:11,color:activePlayer===null?"var(--text)":"var(--muted)",fontWeight:700}}>全員</span>
          </button>
          {players.map(p=>{
            const isFocus=activePlayer===p.name;
            const isDim=activePlayer&&!isFocus;
            return (
              <button key={p.name} onClick={()=>setActivePlayer(isFocus?null:p.name)}
                style={{display:"flex",alignItems:"center",gap:5,border:`1px solid ${isFocus?"rgba(255,255,255,.2)":"transparent"}`,cursor:"pointer",padding:"3px 7px",borderRadius:6,background:isFocus?"rgba(255,255,255,.06)":"transparent",transition:"all 0.15s",opacity:isDim?.22:1}}>
                <ShapeIcon shape={p.shape} color={p.color} size={7}/>
                <span style={{fontSize:11,color:p.color,fontWeight:700}}>{p.name}</span>
              </button>
            );
          })}
        </div>
        <div style={{fontSize:10,color:"var(--muted)",marginTop:6,textAlign:"right"}}>← 横スクロールで全期間を確認　　凡例タップで絞り込み</div>
      </div>
    </div>
  );
}

function SettlementScreen({ games }) {
  const RATE = 50;

  // 日付（YYYY-MM-DD）ごとに対局をグループ化
  const dateMap = {};
  games.forEach(g => {
    const d = new Date(g.date).toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}).replace(/\//g,"-");
    if(!dateMap[d]) dateMap[d] = [];
    dateMap[d].push(g);
  });
  const dates = Object.keys(dateMap).sort((a,b)=>b.localeCompare(a));

  const [selectedDate, setSelectedDate] = useState(dates[0]||"");

  // 選択日のプレーヤーごとにスコアを合算
  const playerTotals = {};
  (dateMap[selectedDate]||[]).forEach(g => {
    g.results.forEach(r => {
      if(!playerTotals[r.name]) playerTotals[r.name] = 0;
      playerTotals[r.name] += r.total;
    });
  });
  const rows = Object.entries(playerTotals)
    .map(([name,total])=>({name,total,amount:total*RATE}))
    .sort((a,b)=>b.total-a.total);

  const formatDate = d => {
    const [y,m,day] = d.split("-");
    return `${y}年${parseInt(m)}月${parseInt(day)}日`;
  };

  return (
    <div className="screen animate-in" style={{gap:14}}>
      <div className="card">
        <div className="card-title">精算</div>
        {dates.length===0
          ? <div style={{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"20px 0"}}>対局データがありません</div>
          : <>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>開催日を選択</div>
              <select value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
                style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:14,padding:"10px 12px",outline:"none"}}>
                {dates.map(d=>(
                  <option key={d} value={d}>{formatDate(d)}（{dateMap[d].length}卓）</option>
                ))}
              </select>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>レート：{RATE}円 / 1pt</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
              <thead>
                <tr style={{borderBottom:"1px solid var(--border)"}}>
                  <th style={{padding:"8px 10px",textAlign:"left",color:"var(--muted)",fontWeight:700,fontSize:12}}>プレーヤー</th>
                  <th style={{padding:"8px 10px",textAlign:"right",color:"var(--muted)",fontWeight:700,fontSize:12}}>スコア</th>
                  <th style={{padding:"8px 10px",textAlign:"right",color:"var(--accent)",fontWeight:700,fontSize:12}}>精算額</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={r.name} style={{borderBottom:"1px solid var(--border)",background:i%2===0?"transparent":"rgba(255,255,255,0.02)"}}>
                    <td style={{padding:"12px 10px",fontWeight:700}}>{r.name}</td>
                    <td style={{padding:"12px 10px",textAlign:"right",color:r.total>0?"var(--green)":r.total<0?"var(--red)":"var(--muted)",fontWeight:700}}>{formatPt(r.total,true)}</td>
                    <td style={{padding:"12px 10px",textAlign:"right",fontWeight:900,fontSize:16,color:r.amount>0?"var(--green)":r.amount<0?"var(--red)":"var(--muted)"}}>{r.amount>0?"+":""}{r.amount.toLocaleString()}円</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{borderTop:"2px solid var(--border)"}}>
                  <td colSpan={2} style={{padding:"10px 10px",textAlign:"right",fontSize:12,color:"var(--muted)",fontWeight:700}}>合計</td>
                  <td style={{padding:"10px 10px",textAlign:"right",fontWeight:900,fontSize:14,color:"var(--muted)"}}>{rows.reduce((s,r)=>s+r.amount,0).toLocaleString()}円</td>
                </tr>
              </tfoot>
            </table>
          </>
        }
      </div>
    </div>
  );
}

function SettingsScreen({ settings, onSave, onRecalc, onExport, onDeleteAll, onAddManual, onUpdateManual, manualGames }) {
  const [s, setS] = useState(()=>JSON.parse(JSON.stringify(settings)));
  const [saved, setSaved] = useState(false);

  // 手入力フォームの状態
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0,10));
  const [manualScores, setManualScores] = useState(()=>Object.fromEntries(MEMBER_LIST.map(m=>[m,""])));
  const [manualSaved, setManualSaved] = useState(false);

  // 編集モード
  const [editingManualId, setEditingManualId] = useState(null);

  const setManualScore = (name, val) => setManualScores(prev=>({...prev,[name]:val}));

  const startEdit = (g) => {
    const scores = Object.fromEntries(MEMBER_LIST.map(m=>[m,""]));
    g.results.forEach(r=>{ scores[r.name] = String(r.total); });
    setManualScores(scores);
    setManualDate(g.date.slice(0,10));
    setEditingManualId(g.id);
    setShowManual(true);
    setTimeout(()=>document.querySelector(".manual-form-card")?.scrollIntoView({behavior:"smooth"}),100);
  };

  const cancelEdit = () => {
    setEditingManualId(null);
    setManualDate(new Date().toISOString().slice(0,10));
    setManualScores(Object.fromEntries(MEMBER_LIST.map(m=>[m,""])));
  };

  const handleManualSave = () => {
    const entries = MEMBER_LIST
      .filter(name => manualScores[name] !== "" && manualScores[name] !== null)
      .map(name => ({ name, score: Number(manualScores[name]) }));
    if(entries.length === 0) return;
    const sorted = [...entries].sort((a,b)=>b.score-a.score);
    const results = sorted.map((p,i)=>({
      id:i, name:p.name, rank:i+1, raw:0, uma:0, rawPoints:0, origIdx:i,
      total:p.score,
    }));
    const entry = {
      id: editingManualId || genId(), mode:MODES.FOUR, manual:true,
      date: manualDate + "T12:00:00.000+09:00",
      settings:DEFAULT_SETTINGS[MODES.FOUR],
      memo:"", results,
    };
    if(editingManualId) {
      onUpdateManual(entry);
    } else {
      onAddManual(entry);
    }
    setManualSaved(true);
    setTimeout(()=>setManualSaved(false),1500);
    setEditingManualId(null);
    setManualScores(Object.fromEntries(MEMBER_LIST.map(m=>[m,""])));
    setManualDate(new Date().toISOString().slice(0,10));
  };

  const update = (mode,key,val) => setS(prev=>({...prev,[mode]:{...prev[mode],[key]:val}}));
  const updateUma = (mode,idx,val) => setS(prev=>{const uma=[...prev[mode].uma];uma[idx]=val===""||val==="-"?val:(parseInt(val)||0);return{...prev,[mode]:{...prev[mode],uma}};});
  const stepUma = (mode,idx,d) => setS(prev=>{const uma=[...prev[mode].uma];uma[idx]=(parseInt(uma[idx])||0)+d;return{...prev,[mode]:{...prev[mode],uma}};});
  const handleSave = () => {
    const n=JSON.parse(JSON.stringify(s));
    [MODES.FOUR,MODES.THREE].forEach(m=>{n[m].uma=n[m].uma.map(u=>parseInt(u)||0);});
    onSave(n); setSaved(true); setTimeout(()=>setSaved(false),1500);
  };
  const SBtn = ({onClick,children}) => (
    <button style={{width:32,height:38,borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:18,cursor:"pointer",flexShrink:0,transition:"all 0.12s"}}
      onPointerDown={e=>e.currentTarget.style.transform="scale(0.88)"} onPointerUp={e=>e.currentTarget.style.transform="scale(1)"} onPointerLeave={e=>e.currentTarget.style.transform="scale(1)"}
      onClick={onClick}>{children}</button>
  );
  return (
    <div className="screen animate-in">
      <div className="card">
        <div className="card-title" style={{fontSize:13}}>データ管理</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button className="btn btn-secondary" onClick={onExport} style={{width:"100%",fontSize:14}}>
            💾　データをJSONでバックアップ
          </button>
          <button className="btn btn-secondary" onClick={onRecalc} style={{width:"100%",fontSize:14}}>
            🔄　全履歴を再計算する（四麻・三麻）
          </button>
          <button className="btn btn-secondary" onClick={()=>setShowManual(v=>!v)} style={{width:"100%",fontSize:14}}>
            ✏️　過去データを手入力で追加
          </button>
          <button className="btn btn-secondary" onClick={()=>{const pw=window.prompt("パスワードを入力してください");if(pw==="fight")onDeleteAll();else if(pw!==null)window.alert("パスワードが違います");}} style={{width:"100%",fontSize:14,color:"var(--red)",borderColor:"var(--red)"}}>
            🗑　全履歴を削除する
          </button>
        </div>
      </div>

      {showManual&&(
        <>
          {/* 既存の手入力データ一覧 */}
          {manualGames.length>0&&(
            <div className="card">
              <div className="card-title" style={{fontSize:13}}>手入力済みデータ</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...manualGames].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(g=>{
                  const d = new Date(g.date);
                  const label = `${d.getMonth()+1}/${d.getDate()} （${g.results.length}人）`;
                  const isEditing = editingManualId===g.id;
                  return (
                    <div key={g.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 4px",borderBottom:"1px solid var(--border)"}}>
                      <div>
                        <span style={{fontWeight:700,fontSize:14}}>{label}</span>
                        <span style={{fontSize:12,color:"var(--muted)",marginLeft:8}}>{g.results.map(r=>r.name).join("・")}</span>
                      </div>
                      <button onClick={()=>isEditing?cancelEdit():startEdit(g)}
                        style={{padding:"4px 12px",borderRadius:8,border:"1px solid var(--border)",background:isEditing?"var(--surface2)":"var(--accent)",color:isEditing?"var(--muted)":"#fff",fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>
                        {isEditing?"キャンセル":"編集"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 手入力フォーム */}
          <div className="card manual-form-card">
            <div className="card-title" style={{fontSize:13}}>{editingManualId?"手入力データを編集":"過去データを手入力で追加"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div className="setting-row">
                <div className="setting-label">対局日</div>
                <input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)}
                  style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:14,padding:"6px 10px",outline:"none"}}/>
              </div>
              <div style={{fontSize:12,color:"var(--muted)"}}>スコアを入力したプレーヤーのみ保存されます</div>
              {MEMBER_LIST.map(name=>(
                <div key={name} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{flex:1,fontSize:14,fontWeight:700}}>{name}</span>
                  <input type="number" placeholder="－" value={manualScores[name]} onChange={e=>setManualScore(name,e.target.value)}
                    onFocus={e=>e.target.select()}
                    style={{width:80,background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",fontFamily:"inherit",fontSize:13,padding:"8px 10px",outline:"none",textAlign:"right"}}/>
                  <span style={{fontSize:12,color:"var(--muted)",minWidth:16}}>pt</span>
                </div>
              ))}
              <button className="btn btn-primary" onClick={handleManualSave}
                style={{background:manualSaved?"linear-gradient(135deg,#2d8a4e,#5cc87a)":undefined,transition:"background 0.3s"}}>
                {manualSaved?"✓ 保存しました！":editingManualId?"変更を保存する":"この対局を追加する"}
              </button>
            </div>
          </div>
        </>
      )}
      {[MODES.FOUR,MODES.THREE].map(mode=>(
        <div key={mode} className="card">
          <div className="card-title">{s[mode].label}設定</div>
          {[["持ち点","startPoints","開始時の点数"],["返し点","returnPoints","精算基準点"]].map(([label,key,sub])=>(
            <div key={key} className="setting-row">
              <div><div className="setting-label">{label}</div><div style={{fontSize:11,color:"var(--muted)"}}>{sub}</div></div>
              <input className="setting-input" type="number" value={s[mode][key]} onFocus={e=>e.target.select()} onChange={e=>update(mode,key,e.target.value===''?'':Number(e.target.value))} onBlur={e=>update(mode,key,parseInt(e.target.value)||0)}/>
            </div>
          ))}
          <div style={{paddingTop:12}}>
            <div style={{fontSize:11,color:"var(--muted)",letterSpacing:"2px",marginBottom:10}}>ウマ（＋－ボタンで5刻み調整）</div>
            <div className="uma-grid">
              {s[mode].uma.map((u,i)=>(
                <div key={i} className="uma-item">
                  <label>{i+1}着</label>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <SBtn onClick={()=>stepUma(mode,i,-5)}>－</SBtn>
                    <input className="setting-input" style={{width:"100%",minWidth:0,fontSize:16,padding:"8px 6px"}} type="number" value={u} onFocus={e=>e.target.select()} onChange={e=>updateUma(mode,i,e.target.value)}/>
                    <SBtn onClick={()=>stepUma(mode,i,5)}>＋</SBtn>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button className="btn btn-primary" onClick={handleSave} style={{background:saved?"linear-gradient(135deg,#2d8a4e,#5cc87a)":undefined,transition:"background 0.3s"}}>
        {saved?"✓ 保存しました！":"設定を保存"}
      </button>
    </div>
  );
}
