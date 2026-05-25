import { useState, useEffect, useRef, useCallback } from "react";
import { ref, get, set, onValue } from 'firebase/database';
import { getToken } from 'firebase/messaging';
import { database, messaging, vapidKey } from './firebase.js';

// ── Utils ──────────────────────────────────────────────────────────────────
const uid    = () => Math.random().toString(36).slice(2,8) + Date.now().toString(36).slice(-3);
const toKey  = d => { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
const fromKey= s => { const[y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
const addD   = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const getMon = d => { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-(x.getDay()===0?6:x.getDay()-1)); return x; };
const getWn  = d => { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()+4-(x.getDay()||7)); const y=new Date(x.getFullYear(),0,1); return Math.ceil(((x-y)/864e5+1)/7); };
const now0   = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const sk     = k => k.replace(/:/g,'__');

const DS      = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const MS      = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const MS_FULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const fmt     = d => { const x=new Date(d); return `${x.getDate()} ${MS[x.getMonth()]}`; };
const wkKey   = d => `wk:${getMon(d).getFullYear()}-W${String(getWn(d)).padStart(2,'0')}`;

const DC = [
  {bg:'#FDF4FF',bd:'#C026D3',tx:'#86198F',name:'Domenica'},
  {bg:'#EFF8FF',bd:'#3B82F6',tx:'#1849A9',name:'Lunedì'},
  {bg:'#F0FDF4',bd:'#16A34A',tx:'#15803D',name:'Martedì'},
  {bg:'#FFFBEB',bd:'#D97706',tx:'#B45309',name:'Mercoledì'},
  {bg:'#F5F3FF',bd:'#7C3AED',tx:'#6D28D9',name:'Giovedì'},
  {bg:'#FFF7ED',bd:'#EA580C',tx:'#C2410C',name:'Venerdì'},
  {bg:'#F0FDFA',bd:'#0D9488',tx:'#0F766E',name:'Sabato'},
];

// UC include anche 'S' per i task condivisi
const UC = {
  '1':{bg:'#E1F5EE',bd:'#1D9E75',tx:'#085041'},
  '2':{bg:'#FAECE7',bd:'#D85A30',tx:'#712B13'},
  'S':{bg:'#EFF6FF',bd:'#0284C7',tx:'#075985'}, // azzurro neutro = condiviso
};

// ── Firebase DB ────────────────────────────────────────────────────────────
const db = {
  get: async k => { try{const s=await get(ref(database,sk(k)));return s.exists()?s.val():null;}catch{return null;} },
  set: async (k,v) => { try{await set(ref(database,sk(k)),v);}catch(e){console.error('db.set',e);} },
};

// ── Stili condivisi ────────────────────────────────────────────────────────
const S = {
  btn:(x={})=>({fontFamily:'inherit',fontSize:13,border:'0.5px solid var(--color-border-secondary)',borderRadius:7,background:'var(--color-background-primary)',color:'var(--color-text-primary)',cursor:'pointer',padding:'5px 12px',...x}),
  sm:{fontFamily:'inherit',fontSize:11,padding:'1px 7px',border:'0.5px solid var(--color-border-secondary)',borderRadius:5,background:'var(--color-background-primary)',color:'var(--color-text-primary)',cursor:'pointer'},
  inp:{fontFamily:'inherit',fontSize:13,padding:'5px 9px',border:'0.5px solid var(--color-border-secondary)',borderRadius:7,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none',width:'100%',boxSizing:'border-box'},
};

// ── Checkbox ───────────────────────────────────────────────────────────────
function Checkbox({done,per,onClick}){
  const c=UC[per]||UC['1'];
  return(
    <div onClick={onClick} style={{width:18,height:18,borderRadius:5,flexShrink:0,cursor:'pointer',border:`2px solid ${done?c.bd:'#B0B8C1'}`,background:done?c.bg:'#fff',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
      {done&&<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke={c.tx} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
  );
}

// ── TaskCard ───────────────────────────────────────────────────────────────
function TaskCard({task,dateStr,weekDays,onToggle,onDel,onMove}){
  const[moving,setMoving]=useState(false);
  const[hov,setHov]=useState(false);
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{marginBottom:4}}>
      <div style={{display:'flex',alignItems:'center',gap:7,padding:'5px 6px',borderRadius:7,background:task.done?'var(--color-background-secondary)':'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)'}}>
        <Checkbox done={task.done} per={task.per} onClick={()=>onToggle(dateStr,task.id)}/>
        <span style={{flex:1,fontSize:12.5,lineHeight:1.3,color:task.done?'var(--color-text-secondary)':'var(--color-text-primary)',textDecoration:task.done?'line-through':'none'}}>
          {task.title}
          {task.movedFrom&&<span style={{fontSize:9.5,color:'var(--color-text-tertiary)',marginLeft:4}}>↳spostato</span>}
        </span>
        {(hov||moving)&&(
          <div style={{display:'flex',gap:3,flexShrink:0}}>
            {weekDays&&<button onClick={()=>setMoving(v=>!v)} style={{...S.sm,fontSize:10}} title="Sposta">→</button>}
            <button onClick={()=>onDel(dateStr,task.id)} style={{...S.sm,fontSize:10,color:'var(--color-text-tertiary)'}}>✕</button>
          </div>
        )}
      </div>
      {moving&&weekDays&&(
        <div style={{display:'flex',gap:4,flexWrap:'wrap',padding:'5px 4px 2px',background:'var(--color-background-secondary)',borderRadius:'0 0 7px 7px',border:'0.5px solid var(--color-border-tertiary)',borderTop:'none'}}>
          <span style={{fontSize:10.5,color:'var(--color-text-tertiary)',alignSelf:'center',marginRight:2}}>Sposta a:</span>
          {weekDays.map((d,i)=>{const k=toKey(d);if(k===dateStr)return null;return<button key={k} onClick={()=>{onMove(dateStr,k,task.id);setMoving(false);}} style={{...S.sm,fontSize:10.5,padding:'2px 8px',borderRadius:12}}>{DS[i]} {d.getDate()}</button>;})}
          <button onClick={()=>setMoving(false)} style={S.sm}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── AddInline ──────────────────────────────────────────────────────────────
function AddInline({dateStr,per,onAdd}){
  const[open,setOpen]=useState(false);const[val,setVal]=useState('');
  const go=()=>{if(val.trim()){onAdd(dateStr,val.trim(),per);setVal('');setOpen(false);}};
  if(!open)return<div onClick={()=>setOpen(true)} style={{fontSize:11,color:'var(--color-text-tertiary)',cursor:'pointer',padding:'3px 0'}}>+ aggiungi</div>;
  return(
    <div style={{marginTop:4}}>
      <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')go();if(e.key==='Escape'){setOpen(false);setVal('');}}} placeholder="Nome attività…" style={{...S.inp,fontSize:12.5,padding:'4px 7px'}}/>
      <div style={{display:'flex',gap:4,marginTop:3}}><button onClick={go} style={S.sm}>✓</button><button onClick={()=>{setOpen(false);setVal('');}} style={S.sm}>✕</button></div>
    </div>
  );
}

// ── PersonSection (usata anche per 'S' condiviso) ──────────────────────────
function PersonSec({per,name,tasks,dateStr,weekDays,onToggle,onDel,onAdd,onMove}){
  const c=UC[per],done=tasks.filter(t=>t.done).length;
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:c.bd}}/>
        <span style={{fontSize:11,color:c.tx,fontWeight:600,flex:1}}>{name}</span>
        {tasks.length>0&&<span style={{fontSize:10,color:done===tasks.length?c.bd:'var(--color-text-tertiary)',fontWeight:done===tasks.length?700:400}}>{done}/{tasks.length}</span>}
      </div>
      {tasks.length===0&&<div style={{fontSize:11.5,color:'var(--color-text-tertiary)',padding:'2px 0 4px',fontStyle:'italic'}}>Nessuna attività</div>}
      {tasks.map(t=><TaskCard key={t.id} task={t} dateStr={dateStr} weekDays={weekDays} onToggle={onToggle} onDel={onDel} onMove={onMove}/>)}
      <AddInline dateStr={dateStr} per={per} onAdd={onAdd}/>
    </div>
  );
}

// ── Today Card ─────────────────────────────────────────────────────────────
function TodayCard({cfg,days,weekDays,onToggle,onDel,onAdd,onMove}){
  const today=now0(),k=toKey(today),tasks=days[k]||[];
  const dc=DC[today.getDay()];
  const t1=tasks.filter(t=>t.per==='1');
  const t2=tasks.filter(t=>t.per==='2');
  const tS=tasks.filter(t=>t.per==='S');
  const allDone=tasks.length>0&&tasks.every(t=>t.done);
  return(
    <div style={{background:dc.bg,borderRadius:18,padding:'20px 18px 18px',border:`1px solid ${dc.bd}30`,marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div>
          <div style={{fontSize:11.5,fontWeight:700,color:dc.tx,textTransform:'uppercase',letterSpacing:'.12em',marginBottom:1}}>{dc.name}</div>
          <div style={{fontSize:44,fontWeight:700,lineHeight:1,color:dc.tx}}>{today.getDate()}</div>
          <div style={{fontSize:13,color:dc.tx,opacity:.65,marginTop:3}}>{MS_FULL[today.getMonth()]} {today.getFullYear()}</div>
        </div>
        {allDone&&<div style={{fontSize:28,marginTop:2}}>🎉</div>}
      </div>

      {/* Sezioni personali */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div style={{background:'rgba(255,255,255,0.65)',borderRadius:12,padding:'10px'}}>
          <PersonSec per="1" name={cfg.u1} tasks={t1} dateStr={k} weekDays={weekDays} onToggle={onToggle} onDel={onDel} onAdd={onAdd} onMove={onMove}/>
        </div>
        <div style={{background:'rgba(255,255,255,0.65)',borderRadius:12,padding:'10px'}}>
          <PersonSec per="2" name={cfg.u2} tasks={t2} dateStr={k} weekDays={weekDays} onToggle={onToggle} onDel={onDel} onAdd={onAdd} onMove={onMove}/>
        </div>
      </div>

      {/* Sezione condivisa — larghezza piena */}
      <div style={{background:'rgba(255,255,255,0.65)',borderRadius:12,padding:'10px',border:`1px dashed ${UC['S'].bd}60`}}>
        <PersonSec per="S" name="🤝 Condiviso" tasks={tS} dateStr={k} weekDays={weekDays} onToggle={onToggle} onDel={onDel} onAdd={onAdd} onMove={onMove}/>
      </div>
    </div>
  );
}

// ── Week Grid ──────────────────────────────────────────────────────────────
function WeekGrid({cfg,days,week,onWeek,onToggle,onDel,onAdd,onMove}){
  const wDays=Array.from({length:7},(_,i)=>addD(week,i));
  const now=now0(),todayStr=toKey(now),isThisWk=toKey(week)===toKey(getMon(now));
  return(
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <button onClick={()=>onWeek(addD(week,-7))} style={S.btn({padding:'3px 10px',fontSize:16})}>‹</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:500}}>{fmt(week)} – {fmt(addD(week,6))} {week.getFullYear()}</div>
          {!isThisWk&&<span onClick={()=>onWeek(getMon(now))} style={{fontSize:10.5,color:'var(--color-text-info)',cursor:'pointer'}}>← questa settimana</span>}
        </div>
        <button onClick={()=>onWeek(addD(week,7))} style={S.btn({padding:'3px 10px',fontSize:16})}>›</button>
      </div>
      <div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:8}}>
        {wDays.map((d,i)=>{
          const k=toKey(d),tasks=days[k]||[],isToday=k===todayStr,isPast=d<now,dc=DC[d.getDay()];
          const t1=tasks.filter(t=>t.per==='1');
          const t2=tasks.filter(t=>t.per==='2');
          const tS=tasks.filter(t=>t.per==='S');
          return(
            <div key={k} style={{minWidth:130,flex:'1 1 130px',background:isToday?dc.bg:'var(--color-background-primary)',border:isToday?`1.5px solid ${dc.bd}50`:'0.5px solid var(--color-border-tertiary)',borderRadius:11,padding:'8px 7px',opacity:isPast&&!isToday?.7:1}}>
              <div style={{marginBottom:7}}>
                <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:isToday?dc.tx:'var(--color-text-tertiary)'}}>{DS[i]}</div>
                <div style={{fontSize:20,fontWeight:600,lineHeight:1.1,color:isToday?dc.tx:'var(--color-text-primary)'}}>{d.getDate()}</div>
              </div>

              {/* Persona 1 */}
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}><div style={{width:6,height:6,borderRadius:'50%',background:UC['1'].bd}}/><span style={{fontSize:9.5,color:UC['1'].tx,fontWeight:600}}>{cfg.u1}</span></div>
              {t1.map(t=><TaskCard key={t.id} task={t} dateStr={k} weekDays={wDays} onToggle={onToggle} onDel={onDel} onMove={onMove}/>)}
              <AddInline dateStr={k} per="1" onAdd={onAdd}/>

              <div style={{borderTop:'0.5px solid var(--color-border-tertiary)',margin:'6px 0'}}/>

              {/* Persona 2 */}
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}><div style={{width:6,height:6,borderRadius:'50%',background:UC['2'].bd}}/><span style={{fontSize:9.5,color:UC['2'].tx,fontWeight:600}}>{cfg.u2}</span></div>
              {t2.map(t=><TaskCard key={t.id} task={t} dateStr={k} weekDays={wDays} onToggle={onToggle} onDel={onDel} onMove={onMove}/>)}
              <AddInline dateStr={k} per="2" onAdd={onAdd}/>

              <div style={{borderTop:`0.5px dashed ${UC['S'].bd}80`,margin:'6px 0'}}/>

              {/* Condiviso */}
              <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}><div style={{width:6,height:6,borderRadius:'50%',background:UC['S'].bd}}/><span style={{fontSize:9.5,color:UC['S'].tx,fontWeight:600}}>Condiviso</span></div>
              {tS.map(t=><TaskCard key={t.id} task={t} dateStr={k} weekDays={wDays} onToggle={onToggle} onDel={onDel} onMove={onMove}/>)}
              <AddInline dateStr={k} per="S" onAdd={onAdd}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar Tab ───────────────────────────────────────────────────────────
function CalTab({cfg,days,week,onWeek,onToggle,onDel,onAdd,onMove}){
  const[expanded,setExpanded]=useState(false);
  const weekDays=Array.from({length:7},(_,i)=>addD(week,i));
  const dc=DC[now0().getDay()];
  return(
    <div>
      <TodayCard cfg={cfg} days={days} weekDays={weekDays} onToggle={onToggle} onDel={onDel} onAdd={onAdd} onMove={onMove}/>
      <div style={{textAlign:'center',marginBottom:14}}>
        <button onClick={()=>setExpanded(v=>!v)} style={S.btn({fontSize:12.5,padding:'6px 18px',color:dc.tx,borderColor:dc.bd+'60',background:dc.bg})}>
          {expanded?'↑ Chiudi settimana':'↓ Tutta la settimana'}
        </button>
      </div>
      {expanded&&<WeekGrid cfg={cfg} days={days} week={week} onWeek={onWeek} onToggle={onToggle} onDel={onDel} onAdd={onAdd} onMove={onMove}/>}
    </div>
  );
}

// ── Form template ──────────────────────────────────────────────────────────
function TplForm({cfg,initial,onSave,onCancel}){
  const[form,setForm]=useState(initial);
  const togDay=d=>setForm(p=>({...p,days:p.days.includes(d)?p.days.filter(x=>x!==d):[...p.days,d]}));
  const save=()=>{if(!form.title.trim())return;onSave({...form,days:form.days.length?[...form.days]:[1]});};
  return(
    <div style={{background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-secondary)',borderRadius:10,padding:14,marginTop:10}}>
      <div style={{marginBottom:10}}>
        <label style={{fontSize:11.5,color:'var(--color-text-secondary)',display:'block',marginBottom:4}}>Attività</label>
        <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Es. Palestra, Spesa, Meditazione…" style={S.inp}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div>
          <label style={{fontSize:11.5,color:'var(--color-text-secondary)',display:'block',marginBottom:4}}>Persona</label>
          <select value={form.per} onChange={e=>setForm(p=>({...p,per:e.target.value}))} style={S.inp}>
            <option value="1">{cfg.u1}</option>
            <option value="2">{cfg.u2}</option>
            <option value="S">🤝 Condiviso</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:11.5,color:'var(--color-text-secondary)',display:'block',marginBottom:4}}>Frequenza</label>
          <select value={form.freq} onChange={e=>setForm(p=>({...p,freq:e.target.value}))} style={S.inp}>
            <option value="weekly">Settimanale</option>
            <option value="biweekly">Bisettimanale</option>
            <option value="monthly">Mensile</option>
          </select>
        </div>
      </div>
      {(form.freq==='weekly'||form.freq==='biweekly')&&(
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11.5,color:'var(--color-text-secondary)',display:'block',marginBottom:6}}>Giorni</label>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {DS.map((d,i)=>{const day=i+1,sel=form.days.includes(day),c=UC[form.per]||UC['1'];return(
              <button key={i} onClick={()=>togDay(day)} style={{fontSize:11.5,padding:'3px 9px',borderRadius:20,background:sel?c.bg:'transparent',border:`1px solid ${sel?c.bd:'var(--color-border-secondary)'}`,color:sel?c.tx:'var(--color-text-secondary)',cursor:'pointer',fontFamily:'inherit'}}>{d}</button>
            );})}
          </div>
        </div>
      )}
      {form.freq==='biweekly'&&(
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11.5,color:'var(--color-text-secondary)',display:'block',marginBottom:5}}>Ricorrenza</label>
          <div style={{display:'flex',gap:6}}>
            {['Sett. pari','Sett. dispari'].map((lbl,i)=>(
              <button key={i} onClick={()=>setForm(p=>({...p,parity:i}))} style={{fontSize:11.5,padding:'3px 10px',borderRadius:20,background:form.parity===i?'var(--color-background-info)':'transparent',border:`1px solid ${form.parity===i?'var(--color-border-info)':'var(--color-border-secondary)'}`,cursor:'pointer',fontFamily:'inherit'}}>{lbl}</button>
            ))}
          </div>
        </div>
      )}
      {form.freq==='monthly'&&(
        <div style={{marginBottom:10}}>
          <label style={{fontSize:11.5,color:'var(--color-text-secondary)',display:'block',marginBottom:4}}>Giorno del mese</label>
          <input type="number" min="1" max="31" value={form.dom} onChange={e=>setForm(p=>({...p,dom:+e.target.value||1}))} style={{...S.inp,width:70}}/>
        </div>
      )}
      <div style={{display:'flex',gap:8}}>
        <button onClick={save} style={S.btn({padding:'5px 16px'})}>Salva</button>
        <button onClick={onCancel} style={S.btn({padding:'5px 16px'})}>Annulla</button>
      </div>
    </div>
  );
}

// ── Templates ──────────────────────────────────────────────────────────────
function TplView({tpls,cfg,onSave}){
  const[list,setList]=useState(tpls);
  const[mode,setMode]=useState(null);
  const[editId,setEditId]=useState(null);
  useEffect(()=>setList(tpls),[tpls]);
  const persist=nl=>{setList(nl);onSave(nl);};
  const close=()=>{setMode(null);setEditId(null);};
  const handleSave=formData=>{
    if(mode==='edit') persist(list.map(t=>t.id===editId?{...formData,id:editId}:t));
    else persist([...list,{...formData,id:uid()}]);
    close();
  };
  const emptyForm={title:'',per:'1',freq:'weekly',days:[],parity:0,dom:1};
  const editingTpl=editId?list.find(t=>t.id===editId):null;
  const formInitial=mode==='edit'&&editingTpl
    ?{title:editingTpl.title,per:editingTpl.per,freq:editingTpl.freq,days:[...editingTpl.days],parity:editingTpl.parity||0,dom:editingTpl.dom||1}
    :emptyForm;
  const FL={weekly:'Settimanale',biweekly:'Bisettimanale',monthly:'Mensile'};
  const perName=(per)=>per==='1'?cfg.u1:per==='2'?cfg.u2:'🤝 Condiviso';
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <span style={{fontSize:15,fontWeight:500}}>Attività ricorrenti</span>
        {!mode&&<button onClick={()=>setMode('add')} style={S.btn()}>+ Aggiungi</button>}
      </div>
      {!list.length&&!mode&&<p style={{color:'var(--color-text-secondary)',fontSize:13.5,lineHeight:1.6}}>Nessuna attività ricorrente. Aggiungine una per popolare automaticamente il calendario ogni settimana.</p>}
      {list.map(t=>{
        const c=UC[t.per]||UC['1'];
        const dL=t.freq==='monthly'?`giorno ${t.dom}`:t.days.sort((a,b)=>a-b).map(d=>DS[d-1]).join(', ');
        const isEditing=mode==='edit'&&editId===t.id;
        return(
          <div key={t.id}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:isEditing?'var(--color-background-secondary)':'var(--color-background-primary)',border:`0.5px solid ${isEditing?'var(--color-border-primary)':'var(--color-border-tertiary)'}`,borderRadius:isEditing?'8px 8px 0 0':8,marginBottom:isEditing?0:6}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:c.bd,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13.5,fontWeight:500}}>{t.title}</div>
                <div style={{fontSize:11.5,color:'var(--color-text-secondary)',marginTop:1}}>{perName(t.per)} · {FL[t.freq]} · {dL}</div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>isEditing?close():(setEditId(t.id),setMode('edit'))} style={S.btn({fontSize:11,padding:'2px 8px'})}>{isEditing?'✕':'✏️'}</button>
                <button onClick={()=>persist(list.filter(x=>x.id!==t.id))} style={S.btn({fontSize:11,padding:'2px 7px',color:'var(--color-text-danger)',borderColor:'var(--color-border-danger)'})}>✕</button>
              </div>
            </div>
            {isEditing&&(
              <div style={{border:'0.5px solid var(--color-border-primary)',borderTop:'none',borderRadius:'0 0 8px 8px',marginBottom:6,overflow:'hidden'}}>
                <TplForm cfg={cfg} initial={formInitial} onSave={handleSave} onCancel={close}/>
              </div>
            )}
          </div>
        );
      })}
      {mode==='add'&&<TplForm cfg={cfg} initial={emptyForm} onSave={handleSave} onCancel={close}/>}
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────
function CfgView({cfg,onSave}){
  const[f,setF]=useState({...cfg}),[ok,setOk]=useState(false);
  const save=()=>{onSave(f);setOk(true);setTimeout(()=>setOk(false),2000);};
  return(
    <div style={{maxWidth:340}}>
      {[['1','u1'],['2','u2']].map(([p,k])=>(
        <div key={p} style={{marginBottom:14}}>
          <label style={{fontSize:12.5,color:UC[p].tx,fontWeight:500,display:'block',marginBottom:5}}><span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:UC[p].bd,marginRight:6}}/>Nome persona {p}</label>
          <input value={f[k]} onChange={e=>setF(v=>({...v,[k]:e.target.value}))} style={S.inp}/>
        </div>
      ))}
      <button onClick={save} style={S.btn({padding:'6px 18px'})}>{ok?'✓ Salvato':'Salva modifiche'}</button>
    </div>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────
function Setup({onDone}){
  const[f,setF]=useState({u1:'',u2:''}),ok=f.u1.trim()&&f.u2.trim();
  return(
    <div style={{maxWidth:380,margin:'3rem auto',padding:'2rem',background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:18,boxShadow:'0 2px 20px rgba(0,0,0,0.06)'}}>
      <div style={{fontSize:28,marginBottom:10}}>🗓️</div>
      <div style={{fontSize:22,fontWeight:600,marginBottom:6}}>Benvenuti!</div>
      <p style={{fontSize:13.5,color:'var(--color-text-secondary)',marginBottom:24,lineHeight:1.6}}>Inserite i vostri nomi per iniziare a organizzare la settimana insieme.</p>
      {[['1','u1','Es. Marco'],['2','u2','Es. Laura']].map(([p,k,ph])=>(
        <div key={p} style={{marginBottom:14}}>
          <label style={{fontSize:12.5,color:UC[p].tx,fontWeight:600,display:'block',marginBottom:6}}><span style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:UC[p].bd,marginRight:7}}/>Persona {p}</label>
          <input value={f[k]} onChange={e=>setF(v=>({...v,[k]:e.target.value}))} placeholder={ph} style={{...S.inp,fontSize:14,padding:'8px 11px'}}/>
        </div>
      ))}
      <button onClick={()=>ok&&onDone(f)} disabled={!ok} style={S.btn({width:'100%',padding:'10px',fontSize:15,marginTop:10,opacity:ok?1:.4})}>Inizia →</button>
    </div>
  );
}

// ── User Picker ────────────────────────────────────────────────────────────
function UserPick({cfg,onPick}){
  return(
    <div style={{maxWidth:320,margin:'3rem auto',textAlign:'center'}}>
      <div style={{fontSize:18,fontWeight:600,marginBottom:6}}>Chi sei?</div>
      <div style={{fontSize:13.5,color:'var(--color-text-secondary)',marginBottom:28}}>Seleziona il tuo profilo per continuare</div>
      <div style={{display:'flex',gap:16,justifyContent:'center'}}>
        {[['1',cfg.u1],['2',cfg.u2]].map(([p,name])=>(
          <button key={p} onClick={()=>onPick(p)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'22px 28px',borderRadius:16,background:'var(--color-background-primary)',border:`1.5px solid ${UC[p].bd}`,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 2px 12px rgba(0,0,0,0.06)'}}>
            <div style={{width:56,height:56,borderRadius:'50%',background:UC[p].bg,border:`2px solid ${UC[p].bd}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:UC[p].tx}}>{name.slice(0,2).toUpperCase()}</div>
            <span style={{fontSize:15,fontWeight:500}}>{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── App principale ─────────────────────────────────────────────────────────
export default function App(){
  const[user,    setUser]    = useState(null);
  const[cfg,     setCfg]     = useState({u1:'Persona 1',u2:'Persona 2'});
  const[tpls,    setTpls]    = useState([]);
  const[days,    setDays]    = useState({});
  const[week,    setWeek]    = useState(()=>getMon(new Date()));
  const[tab,     setTab]     = useState('cal');
  const[ready,   setReady]   = useState(false);
  const[isSetup, setIsSetup] = useState(false);

  const tplsR  = useRef([]);
  const daysR  = useRef({});
  const wkCache= useRef({});
  useEffect(()=>{tplsR.current=tpls;},[tpls]);
  useEffect(()=>{daysR.current=days;},[days]);

  const buildDay=useCallback((d,dow,wn)=>
    tplsR.current.filter(t=>{
      if(t.freq==='weekly')   return t.days.includes(dow);
      if(t.freq==='biweekly') return t.days.includes(dow)&&(wn%2===t.parity);
      if(t.freq==='monthly')  return d.getDate()===t.dom;
      return false;
    }).map(t=>({id:uid(),tid:t.id,title:t.title,per:t.per,done:false,doneAt:null,movedFrom:null}))
  ,[]);

  const genWeek=useCallback(async mon=>{
    const today=now0();
    const wk=wkKey(mon);
    let wd=wkCache.current[wk];
    if(wd===undefined){const stored=await db.get(wk);wkCache.current[wk]=stored;wd=stored;}
    wd=wd||{};const wn=getWn(mon);let changed=false;
    for(let i=0;i<7;i++){const d=addD(mon,i),k=toKey(d);if(wd[k]!==undefined)continue;wd[k] = d < today ? [] : buildDay(d,d.getDay()===0?7:d.getDay(),wn);changed=true;}
    if(changed){wkCache.current[wk]=wd;await db.set(wk,wd);}
    setDays(prev=>({...prev,...wd}));
  },[buildDay]);

  const regenerateFuture=useCallback(async newTpls=>{
    const now=now0();
    for(const mon of[getMon(now),addD(getMon(now),7)]){
      const wk=wkKey(mon);let wd=wkCache.current[wk]||{};const wn=getWn(mon);let changed=false;
      for(let i=0;i<7;i++){
        const d=addD(mon,i),k=toKey(d);if(d<now)continue;
        const existing=wd[k]||[];
        const keep=existing.filter(t=>t.done||!t.tid);
        const doneTids=new Set(existing.filter(t=>t.done&&t.tid).map(t=>t.tid));
        const dow=d.getDay()===0?7:d.getDay();
        const fresh=newTpls.filter(t=>{
          let m=false;
          if(t.freq==='weekly')   m=t.days.includes(dow);
          if(t.freq==='biweekly') m=t.days.includes(dow)&&(wn%2===t.parity);
          if(t.freq==='monthly')  m=d.getDate()===t.dom;
          return m&&!doneTids.has(t.id);
        }).map(t=>({id:uid(),tid:t.id,title:t.title,per:t.per,done:false,doneAt:null,movedFrom:null}));
        const rebuilt=[...keep,...fresh];
        if(JSON.stringify(rebuilt.map(t=>t.id))!==JSON.stringify(existing.map(t=>t.id))){wd[k]=rebuilt;changed=true;}
      }
      if(changed){wkCache.current[wk]=wd;await db.set(wk,wd);setDays(prev=>({...prev,...wd}));}
    }
  },[]);

  useEffect(()=>{
    (async()=>{
      const[c,t,sp]=await Promise.all([db.get('cfg'),db.get('tpls'),db.get('setup')]);
      if(c)setCfg(c);if(t){setTpls(t);tplsR.current=t;}if(sp)setIsSetup(true);
      const now=now0();
      const mons=Array.from({length:10},(_,i)=>getMon(addD(getMon(now),(i-8)*7)));
      const res=await Promise.all(mons.map(m=>db.get(wkKey(m)).then(v=>({m,v}))));
      const dm={};for(const{m,v}of res){wkCache.current[wkKey(m)]=v;if(v)Object.assign(dm,v);}
      setDays(dm);setReady(true);
    })();
  },[]);

  useEffect(()=>{if(!ready)return;genWeek(week);genWeek(addD(week,7));},[ready,week,genWeek]);

  useEffect(()=>{
    if(!ready)return;
    const wk=wkKey(week);
    const u=onValue(ref(database,sk(wk)),snap=>{
      if(snap.exists()){wkCache.current[wk]=snap.val();setDays(prev=>({...prev,...snap.val()}));}
    });
    return()=>u();
  },[ready,week]);

  useEffect(()=>{
    if(!ready)return;
    const u1=onValue(ref(database,'cfg'),  s=>{if(s.exists())setCfg(s.val());});
    const u2=onValue(ref(database,'tpls'), s=>{if(s.exists()){setTpls(s.val());tplsR.current=s.val();}});
    return()=>{u1();u2();};
  },[ready]);

  useEffect(()=>{
    if(!user||!ready)return;
    (async()=>{
      try{
        if(!('Notification' in window))return;
        const permission=await Notification.requestPermission();
        if(permission!=='granted')return;
        const token=await getToken(messaging,{vapidKey});
        if(token){
          const otherUser=user==='1'?'2':'1';
          const otherData=await db.get(`fcm_tokens/${otherUser}`);
          if(otherData&&Object.values(otherData).includes(token)) await db.set(`fcm_tokens/${otherUser}`,null);
          await db.set(`fcm_tokens/${user}`,{main:token});
        }
      }catch(e){ console.log('Notifiche non disponibili:',e.message); }
    })();
  },[user,ready]);

  const autoMoved=useRef(false);
  useEffect(()=>{
    if(!ready||autoMoved.current)return;
    autoMoved.current=true;
    setTimeout(async()=>{
      const now=now0(),todayStr=toKey(now),mon=getMon(now);
      const prev=daysR.current,updates={};
      let todayTasks=[...(prev[todayStr]||[])],changed=false;
      for(let i=0;i<7;i++){
        const d=addD(mon,i);d.setHours(0,0,0,0);if(d>=now)break;
        const k=toKey(d),tasks=prev[k];if(!tasks||!tasks.length)continue;
        const inc=tasks.filter(t=>!t.done);if(!inc.length)continue;
        updates[k]=tasks.filter(t=>t.done);
        for(const t of inc)todayTasks.push({...t,id:uid(),movedFrom:t.movedFrom||k});
        changed=true;
      }
      if(!changed)return;
      updates[todayStr]=todayTasks;
      const wkS={};
      for(const[k,v]of Object.entries(updates)){const wk=wkKey(getMon(fromKey(k)));if(!wkS[wk])wkS[wk]={...(wkCache.current[wk]||{})};wkS[wk][k]=v;}
      await Promise.all(Object.entries(wkS).map(([wk,wd])=>{wkCache.current[wk]=wd;return db.set(wk,wd);}));
      setDays(prev=>({...prev,...updates}));
    },300);
  },[ready]);

  const saveDay=async(dateStr,tasks)=>{
    const wk=wkKey(getMon(fromKey(dateStr)));
    if(!wkCache.current[wk])wkCache.current[wk]={};
    wkCache.current[wk][dateStr]=tasks;
    await db.set(wk,wkCache.current[wk]);
    setDays(prev=>({...prev,[dateStr]:tasks}));
  };

  const toggle=(ds,id)=>saveDay(ds,(days[ds]||[]).map(t=>t.id===id?{...t,done:!t.done,doneAt:!t.done?new Date().toISOString():null}:t));
  const delTask=(ds,id)=>saveDay(ds,(days[ds]||[]).filter(t=>t.id!==id));

  const addTask=async(dateStr,title,per)=>{
    await saveDay(dateStr,[...(days[dateStr]||[]),{id:uid(),tid:null,title,per,done:false,doneAt:null,movedFrom:null}]);
    if(user&&isSetup){
      const addedBy=user==='1'?cfg.u1:cfg.u2;
      if(per==='S'){
        // Task condiviso → notifica l'altra persona
        const otherUser=user==='1'?'2':'1';
        fetch('/.netlify/functions/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toUser:otherUser,taskTitle:title,addedBy,shared:true})}).catch(()=>{});
      } else if(per!==user){
        // Task personale aggiunto alla lista dell'altro
        fetch('/.netlify/functions/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toUser:per,taskTitle:title,addedBy})}).catch(()=>{});
      }
    }
  };

  const moveTask=async(from,to,id)=>{
    const ft=(days[from]||[]),t=ft.find(x=>x.id===id);if(!t)return;
    await saveDay(from,ft.filter(x=>x.id!==id));
    await saveDay(to,[...(days[to]||[]),{...t,id:uid(),movedFrom:t.movedFrom||from}]);
  };

  const saveTpls=async nt=>{setTpls(nt);tplsR.current=nt;await db.set('tpls',nt);await regenerateFuture(nt);};
  const saveCfg =async c=>{setCfg(c);await db.set('cfg',c);await db.set('setup',true);setIsSetup(true);};

  if(!ready)   return<div style={{padding:'4rem',textAlign:'center',color:'var(--color-text-secondary)',fontSize:15}}>Connessione a Firebase…</div>;
  if(!isSetup) return<Setup onDone={saveCfg}/>;
  if(!user)    return<UserPick cfg={cfg} onPick={setUser}/>;
  const uName=user==='1'?cfg.u1:cfg.u2;

  return(
    <div style={{maxWidth:940,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,padding:'0 4px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:UC[user].bg,border:`2px solid ${UC[user].bd}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:UC[user].tx}}>{uName.slice(0,2).toUpperCase()}</div>
          <span style={{fontSize:15,fontWeight:500}}>Ciao, {uName} 👋</span>
        </div>
        <button onClick={()=>setUser(null)} style={S.btn({fontSize:12,padding:'3px 10px'})}>Cambia</button>
      </div>
      <div style={{display:'flex',marginBottom:18,borderBottom:'1px solid var(--color-border-tertiary)'}}>
        {[['cal','Calendario'],['tpls','Attività'],['set','Impostazioni']].map(([v,lbl])=>(
          <button key={v} onClick={()=>setTab(v)} style={{fontFamily:'inherit',fontSize:13,padding:'8px 16px',background:'none',border:'none',borderBottom:tab===v?'2px solid var(--color-text-primary)':'2px solid transparent',color:tab===v?'var(--color-text-primary)':'var(--color-text-secondary)',cursor:'pointer',fontWeight:tab===v?600:400,marginBottom:-1}}>
            {lbl}
          </button>
        ))}
      </div>
      {tab==='cal'  &&<CalTab  cfg={cfg} days={days} week={week} onWeek={setWeek} onToggle={toggle} onDel={delTask} onAdd={addTask} onMove={moveTask}/>}
      {tab==='tpls' &&<TplView tpls={tpls} cfg={cfg} onSave={saveTpls}/>}
      {tab==='set'  &&<CfgView cfg={cfg} onSave={saveCfg}/>}
    </div>
  );
}
