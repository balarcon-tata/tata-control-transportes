// TATA Control de Transportes V7 - sitio estático, sin dependencias.
// Solo clave PUBLICABLE, protegida por Auth + RLS. No incluir service_role ni secretos.
const PROJECT_URL = ''; // Conexion desactivada por seguridad del proyecto compartido
const PUBLISHABLE_KEY = ''; // Pendiente asegurar tablas preexistentes
const SESSION_STORE = 'tata_tc_v7_session';
const PLACES = ['Planta Cinturones', 'Planta Fajas', 'Estacion de Carga'];
const MODES = {pie:'A pie',scooter:'Scooter',camion:'Camión',tuctuc:'Tuc tuc'};
const ICONS = {pie:'🚶',scooter:'🛴',camion:'🚚',tuctuc:'🛺'};
const app = document.querySelector('#app');
const state = {session:null,authUser:null,profile:null,data:{personal:[],vehicles:[],routes:[],transfers:[],marks:[],alerts:[]},tab:'resumen',viewMode:'salida',busy:false,scanner:null,clock:null,poll:null,selectedTransfer:null,search:'',lastError:null};

const esc = (val) => String(val ?? '').replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const minuteDiff = (a,b=Date.now()) => Math.max(0, Math.floor((new Date(b).getTime()-new Date(a).getTime())/60000));
const timeGT = (val) => !val?'—':new Intl.DateTimeFormat('es-GT',{timeZone:'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(val));
const isGuard = ()=>['admin','supervisor','guardia','operador'].includes(state.profile?.rol);
const isAdmin = ()=>state.profile?.rol==='admin';
function showToast(message,isError=false){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast'+(isError?' error-toast':'');el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),6500)}
function setBusy(val){state.busy=val;document.querySelectorAll('[data-working]').forEach(b=>b.disabled=val)}
function readSession(){try{const s=JSON.parse(localStorage.getItem(SESSION_STORE)||'null');return s?.access_token&&s?.refresh_token?s:null;}catch{return null}}
function setSession(s){state.session=s; if(s)localStorage.setItem(SESSION_STORE,JSON.stringify(s)); else localStorage.removeItem(SESSION_STORE)}
async function fetchJson(path,{method='GET',body,token,prefer,once=false}={}){
  if(token===undefined && state.session && !once && Date.now() >= state.session.expires_at-60_000)await refreshAuth();
  const access = token===undefined ? state.session?.access_token : token;
  let response;
  try{response=await fetch(PROJECT_URL+path,{method,headers:{apikey:PUBLISHABLE_KEY,...(access?{Authorization:'Bearer '+access}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});}catch{throw new Error('No hay conexión con Supabase. Verifica tu conexión a internet.');}
  let data=null;const raw=await response.text();if(raw){try{data=JSON.parse(raw)}catch{data=raw}}
  if(!response.ok){const code=typeof data==='object'?data?.code:undefined;
    if(response.status===401 && access && !once && token===undefined){await refreshAuth();return fetchJson(path,{method,body,prefer,once:true});}
    const msg=typeof data==='object'?(data?.message||data?.msg||data?.error_description||data?.error):null;
    throw new Error(msg || `Supabase respondió HTTP ${response.status}`+(code?` (${code})`:''));
  }
  return data;
}
async function refreshAuth(){
  if(!state.session?.refresh_token)throw new Error('La sesión ha expirado. Inicia sesión de nuevo.');
  const data=await fetchJson('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:state.session.refresh_token},token:null,once:true});
  if(!data?.access_token)throw new Error('No fue posible renovar la sesión.');
  setSession({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+(data.expires_in||3600)*1000});
}
const select=(table,cols='*',query='')=>fetchJson(`/rest/v1/${table}?select=${encodeURIComponent(cols)}${query?'&'+query:''}`);
async function verifyIdentity(){
  const u=await fetchJson('/auth/v1/user');if(!u?.id)throw new Error('Cuenta no válida.');state.authUser=u;
  const profiles=await select('tc_usuarios','auth_user_id,nombre,rol,activo',`auth_user_id=eq.${encodeURIComponent(u.id)}&limit=1`);
  if(!profiles?.length || !profiles[0].activo)throw new Error('El usuario existe en Supabase, pero no está autorizado en TATA Transportes.');
  state.profile=profiles[0];
}
async function login(email,password){
  const data=await fetchJson('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},token:null,once:true});
  if(!data.access_token)throw new Error('La cuenta no devolvió una sesión de acceso.');
  setSession({access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+(data.expires_in||3600)*1000});
  try{await verifyIdentity()}catch(e){setSession(null);throw e}
}
async function logout(){stopScan();clearInterval(state.poll);clearInterval(state.clock);try{if(state.session)await fetchJson('/auth/v1/logout?scope=local',{method:'POST',body:{},once:true})}catch{} setSession(null);state.authUser=null;state.profile=null;renderLogin();}
async function getData(){
  const [personal,vehicles,routes,transfers,marks,alerts]=await Promise.all([
    select('tc_personal','codigo,nombre,activo,ficticio','activo=eq.true&order=codigo.asc'),
    select('tc_vehiculos','codigo,tipo,nombre,estado,ubicacion,bateria,kilometraje,activo,ficticio','activo=eq.true&order=codigo.asc'),
    select('tc_configuracion','codigo,modalidad,origen,destino,minutos_limite,activo','activo=eq.true&order=modalidad.asc'),
    select('tc_traslados','id,codigo_personal,modalidad,vehiculo_codigo,origen,destino_previsto,destino_real,salida_at,llegada_at,minutos_limite,estado,registrado_por,cerrado_por','order=salida_at.desc&limit=300'),
    select('tc_marcajes','id,traslado_id,tipo,ubicacion,marcado_at','order=marcado_at.desc&limit=400'),
    select('tc_alertas','id,traslado_id,tipo,estado,detalle,detectada_at,notificada_at','order=detectada_at.desc&limit=200'),
  ]);
  state.data={personal,vehicles,routes,transfers,marks,alerts};state.lastError=null;
}
async function reload({quiet=false}={}){
  if(!state.session)return;
  try{await getData();if(!quiet || !['registro'].includes(state.tab))renderApp();else updateStatsOnly();}
  catch(e){state.lastError=e.message;if(!quiet)showToast(e.message,true);if(String(e.message).includes('sesión')||String(e.message).includes('JWT')){await logout()}else if(!quiet)renderApp();}
}
function activeTransfers(){return state.data.transfers.filter(t=>t.estado==='en_curso')}
function overdue(t){return t.estado==='en_curso' && minuteDiff(t.salida_at)>t.minutos_limite}
function summary(){const active=activeTransfers();const today = new Date().toLocaleDateString('en-CA',{timeZone:'America/Guatemala'});return {active:active.length,overdue:active.filter(overdue).length,completed:state.data.transfers.filter(t=>t.estado==='finalizado').length,today:state.data.transfers.filter(t=>new Date(t.salida_at).toLocaleDateString('en-CA',{timeZone:'America/Guatemala'})===today).length}}
function labelMode(m){return (ICONS[m]||'🚐')+' '+(MODES[m]||m)}
function workerName(code){return state.data.personal.find(p=>p.codigo===code)?.nombre||code}
function vehicleName(code){return state.data.vehicles.find(v=>v.codigo===code)?.nombre||code||'—'}
function userTag(){return `<span class="tag ok">● Supabase conectado</span>`}
function nav(){const arr=[['resumen','▦','Resumen'],['registro','⌗','Registro QR'],['activos','↗','En curso'],['historial','▤','Historial'],['flota','▣','Flota'],['config','⚙','Configuración']];return arr.map(([id,ico,label])=>`<button type="button" data-tab="${id}" class="${state.tab===id?'active':''}"><span class="nav-ic">${ico}</span>${label}</button>`).join('')}
function renderLogin(error=''){
 app.innerHTML=`<main class="login-wrap"><section class="login-art"><div><img src="./logo.jpg" alt="TATA Accesorios Globales" class="brand"/></div><div><div class="hero-kicker">Plataforma interna · Versión de pruebas</div><h1 class="hero-title">Control de <span>Transportes</span></h1><p>Registra salidas, confirma llegadas y supervisa los tiempos de traslado entre plantas desde un solo lugar.</p></div><div class="notice">Entorno de pruebas con datos ficticios. El acceso está protegido por Supabase Authentication y permisos de Transportes.</div></section><section class="login-pane"><div class="login-card"><span class="eyebrow">TATA · Acceso seguro</span><h1 style="margin:14px 0 8px">Iniciar sesión</h1><p style="margin-bottom:25px">Ingresa con tu usuario de prueba autorizado.</p><form id="loginForm"><div class="field"><label for="loginEmail">Correo electrónico</label><input id="loginEmail" name="email" type="email" autocomplete="username" placeholder="correo@empresa.com" required/></div><div class="field"><label for="loginPass">Contraseña de Supabase</label><input id="loginPass" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required/></div><button class="btn primary full" data-working>Ingresar al sistema →</button></form>${error?`<div class="error">${esc(error)}</div>`:''}<div class="divider"></div><p class="tiny">Si todavía no puedes entrar, verifica que tu cuenta de Authentication esté confirmada y registrada en <span class="code">tc_usuarios</span>. Nunca compartas contraseñas en el chat.</p></div></section></main>`;
 document.querySelector('#loginForm').onsubmit=async(e)=>{e.preventDefault();if(state.busy)return;const f=new FormData(e.currentTarget);setBusy(true);try{await login(String(f.get('email')).trim().toLowerCase(),String(f.get('password')));state.tab='resumen';await reload();startPolling();}catch(err){renderLogin(err.message)}finally{setBusy(false)}};
}
function renderApp(){
 if(!state.profile)return renderLogin();
 const titles={resumen:['Panel general','Visibilidad en tiempo real de los traslados'],registro:['Registro de marcajes','Salidas y llegadas con gafete o código QR'],activos:['Traslados en curso','Seguimiento y control de demoras'],historial:['Historial de traslados','Registros compartidos y persistentes'],flota:['Control de flota','Disponibilidad de vehículos de prueba'],config:['Configuración de rutas','Límites de traslado habilitados en la base']};
 const [title,desc]=titles[state.tab]||titles.resumen;
 app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div><img src="./logo.jpg" alt="Logo TATA" class="side-brand"/><small>CONTROL DE TRANSPORTES</small></div><nav class="nav">${nav()}</nav><div class="sidebar-bottom"><div class="identity">${esc(state.authUser?.email)}</div><div class="tiny muted" style="margin:8px 0 15px">${esc(state.profile.nombre)} · ${esc(state.profile.rol.toUpperCase())}</div><button class="btn ghost full" id="logoutBtn">Salir de la sesión ↗</button></div></aside><div><nav class="mobile-nav">${nav()}</nav><main class="content"><header class="topbar"><div><div class="eyebrow">TATA • CONTROL DE TRANSPORTES</div><h1>${esc(title)}</h1><div class="sub">${esc(desc)}</div></div><div class="top-actions">${userTag()}<button class="btn small" id="refreshBtn" title="Recargar información">↻ Actualizar</button><button class="btn small" id="logoutMobile">Salir</button></div></header>${state.lastError?`<div class="notice">Error de actualización: ${esc(state.lastError)}</div>`:''}<div id="bodyContent">${content()}</div><div class="footer">TATA · Pruebas con datos ficticios · Supabase · El monitoreo visual no envía mensajes a Teams</div></main></div></div>`;
 for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>changeTab(button.dataset.tab);
 document.querySelector('#logoutBtn')?.addEventListener('click',logout);
 document.querySelector('#logoutMobile')?.addEventListener('click',logout);
 document.querySelector('#refreshBtn')?.addEventListener('click',()=>reload());
 bindContent();
}
function changeTab(t){stopScan();state.tab=t;state.selectedTransfer=null;renderApp()}
function metric(label,value,desc){return `<div class="metric"><div class="label">${label}</div><strong>${value}</strong><div class="desc">${desc}</div></div>`}
function content(){switch(state.tab){case 'registro':return registerView();case 'activos':return activeView();case 'historial':return historyView();case 'flota':return fleetView();case 'config':return configView();default:return dashboardView()}}
function dashboardView(){const s=summary();return `<div class="metrics">${metric('Traslados en curso',s.active,'Actualmente fuera de planta')}${metric('Con demora',`<span class="${s.overdue?'critical':'success-text'}">${s.overdue}</span>`,'Superaron el límite de ruta')}${metric('Salidas de hoy',s.today,'Hora de Guatemala')}${metric('Finalizados',s.completed,'Dentro de últimos 300 registros')}</div><div class="cols"><section class="panel"><div class="panel-title"><h2>Movimientos activos</h2><button class="btn small" data-go="activos">Ver todos →</button></div>${transferTable(activeTransfers().slice(0,7),true)}</section><section class="panel"><div class="panel-title"><h2>Resumen por transporte</h2></div>${Object.keys(MODES).map(m=>{const n=activeTransfers().filter(t=>t.modalidad===m).length;return `<div style="display:flex;justify-content:space-between;border-bottom:1px solid #30343a;padding:15px 0"><strong>${labelMode(m)}</strong><span class="tag ${n?'info':''}">${n} activos</span></div>`}).join('')}<div class="divider"></div><div class="notice small">Los tiempos de demora se calculan en pantalla. Las alertas automáticas hacia Microsoft Teams se implementarán en una fase posterior.</div></section></div>`}
function transferTable(transfers,showAction){if(!transfers.length)return '<div class="empty">No hay traslados en este grupo.</div>';return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Persona</th><th>Medio</th><th>Origen → Destino</th><th>Salida</th><th>Duración</th><th>Estado</th>${showAction?'<th></th>':''}</tr></thead><tbody>${transfers.map(t=>{const duration=minuteDiff(t.salida_at,t.llegada_at||Date.now());const delay=overdue(t);return `<tr><td><div class="mono">${esc(t.codigo_personal)}</div><span class="muted tiny">${esc(workerName(t.codigo_personal))}</span></td><td>${esc(labelMode(t.modalidad))}${t.vehiculo_codigo?`<div class="tiny muted">${esc(t.vehiculo_codigo)}</div>`:''}</td><td>${esc(t.origen)}<div class="tiny muted">→ ${esc(t.destino_real||t.destino_previsto)}</div></td><td>${esc(timeGT(t.salida_at))}</td><td>${duration} min <span class="muted tiny">/ ${t.minutos_limite}</span></td><td><span class="tag ${t.estado==='finalizado'?'ok':delay?'red':'info'}">${t.estado==='finalizado'?'Finalizado':delay?'Demorado':'En curso'}</span></td>${showAction?`<td>${t.estado==='en_curso'&&isGuard()?`<button class="btn small soft" data-arrival-id="${esc(t.id)}">Llegada</button>`:''}</td>`:''}</tr>`}).join('')}</tbody></table></div>`}
function modeOptions(){return Object.entries(MODES).map(([key,value])=>`<option value="${key}">${ICONS[key]} ${value}</option>`).join('')}
function placeOptions(){return PLACES.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}
function registerView(){if(!isGuard())return '<div class="notice">Tu rol es de solo lectura. Puedes consultar el panel y el historial.</div>'; const selected=state.selectedTransfer?state.data.transfers.find(t=>t.id===state.selectedTransfer):null;
 return `<div class="tabs"><button id="modeSalida" class="${state.viewMode==='salida'?'selected':''}">↗ Registrar salida</button><button id="modeLlegada" class="${state.viewMode==='llegada'?'selected':''}">↙ Registrar llegada</button></div><div class="cols"><section class="panel"><div class="panel-title"><h2>${state.viewMode==='salida'?'Nueva salida':'Confirmar llegada'}</h2><span class="tag info">SOLO PRUEBAS</span></div><form id="markForm"><div class="field"><label for="workerCode">Código de gafete (ficticio)</label><input id="workerCode" name="worker" autocomplete="off" placeholder="Ej. TEST-0001" value="${selected?esc(selected.codigo_personal):''}" required/></div><div class="filterline" style="margin:-6px 0 13px"><button class="btn small" type="button" id="scanBtn">⌗ Escanear con cámara</button><span class="tiny muted">También puedes escribir el código manualmente.</span></div><div class="scanner-area" id="scannerArea" hidden><video id="scannerVideo" autoplay muted playsinline></video><div class="scan-status" id="scanStatus">Apunta hacia un código QR o de barras.</div><button class="btn small" type="button" id="stopScanBtn">Cerrar cámara</button></div><div id="workerMatch" class="tiny muted" style="margin-bottom:14px"></div>${state.viewMode==='salida'?`<div class="grid-two"><div class="field"><label for="transportMode">Medio de transporte</label><select name="modalidad" id="transportMode">${modeOptions()}</select></div><div class="field" id="vehicleField" hidden><label for="vehicleCode">Vehículo</label><select name="vehiculo" id="vehicleCode"><option value="">Seleccionar vehículo</option></select></div></div><div class="grid-two"><div class="field"><label>Planta de salida</label><select name="origen" id="originPlace">${placeOptions()}</select></div><div class="field"><label>Planta de destino</label><select name="destino" id="destPlace">${placeOptions()}</select></div></div>`:`<div id="arrivalPreview" class="notice small" style="margin-bottom:15px">Ingresa el código para localizar un traslado activo.</div><div class="field"><label for="arrivalPlace">Lugar de llegada</label><select name="destino" id="arrivalPlace">${placeOptions()}</select></div>`}<button class="btn primary full" data-working style="margin-top:9px">${state.viewMode==='salida'?'Registrar salida':'Confirmar llegada'} →</button></form></section><section class="panel"><div class="panel-title"><h2>Colaboradores de prueba</h2></div>${state.data.personal.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #343940;padding:14px 0"><div><strong>${esc(p.nombre)}</strong><div class="tiny muted">${esc(p.codigo)}</div></div><button class="btn small" data-worker-fill="${esc(p.codigo)}">Usar código</button></div>`).join('')}<div class="divider"></div><div class="notice small">No ingreses datos reales de colaboradores. Esta versión solo acepta los códigos de prueba creados en Supabase.</div></section></div>`;
}
function activeView(){const transfers=activeTransfers();return `<section class="panel"><div class="panel-title"><h2>Traslados activos</h2><span class="tag info">Actualización cada 12 segundos</span></div>${transferTable(transfers,true)}</section>`}
function historyView(){const transfers=[...state.data.transfers].slice(0,300);return `<section class="panel"><div class="panel-title"><h2>Historial reciente</h2><span class="tag">Hasta 300 registros</span></div><div class="filterline" style="margin-bottom:14px"><input class="searchbox" id="historySearch" placeholder="Buscar código, modalidad o planta" value="${esc(state.search)}" /></div><div id="historyTable">${transferTable(transfers.filter(t=>([t.codigo_personal,workerName(t.codigo_personal),t.modalidad,t.origen,t.destino_previsto,t.vehiculo_codigo].join(' ')).toLowerCase().includes(state.search.toLowerCase())),false)}</div></section>`}
function fleetView(){const active=activeTransfers();return `<section class="panel"><div class="panel-title"><h2>Vehículos de prueba</h2><span class="tag">${state.data.vehicles.length} unidades</span></div><div class="vehicle-grid">${state.data.vehicles.map(v=>{const inUse=active.find(t=>t.vehiculo_codigo===v.codigo);return `<div class="vehicle"><div class="tiny muted">${esc(v.codigo)}</div><h3>${esc(labelMode(v.tipo))} · ${esc(v.nombre)}</h3><div class="tag ${inUse?'warn':'ok'}">${inUse?'En traslado':'Sin traslado activo'}</div><div class="divider"></div><div class="tiny muted">${inUse?`Destino: ${esc(inUse.destino_previsto)}`:`Ubicación inicial: ${esc(v.ubicacion||'Sin especificar')}`}</div>${v.bateria!==null&&v.bateria!==undefined?`<div class="tiny muted">Batería registrada: ${v.bateria}%</div>`:''}</div>`}).join('')}</div><div class="divider"></div><div class="notice small">La disponibilidad se calcula a partir de traslados activos. En esta fase no se actualiza automáticamente el estado de inventario del vehículo.</div></section>`}
function configView(){return `<div class="metrics">${metric('Rutas configuradas',state.data.routes.length,'4 medios / 3 ubicaciones')}${metric('Personal de prueba',state.data.personal.length,'Identidades ficticias')}${metric('Flota de prueba',state.data.vehicles.length,'Sin empleados reales')}${metric('Usuario',esc(state.profile?.rol||'—'),'Permisos vinculados a Auth')}</div><section class="panel"><div class="panel-title"><h2>Límites por ruta</h2><span class="tag">Consulta de solo lectura</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Medio</th><th>Origen</th><th>Destino</th><th>Tiempo máximo</th></tr></thead><tbody>${state.data.routes.map(c=>`<tr><td>${esc(labelMode(c.modalidad))}</td><td>${esc(c.origen)}</td><td>${esc(c.destino)}</td><td><span class="tag info">${c.minutos_limite} min</span></td></tr>`).join('')}</tbody></table></div></section><div class="notice">Para mantener el proyecto actual intacto, la app solo permite registrar salidas y llegadas en las tablas nuevas <strong>tc_</strong>. La edición de configuraciones y altas de personal queda restringida a la administración segura de Supabase.</div>`}
function updateStatsOnly(){};
function bindContent(){
 for(const btn of document.querySelectorAll('[data-go]'))btn.onclick=()=>changeTab(btn.dataset.go);
 for(const btn of document.querySelectorAll('[data-arrival-id]'))btn.onclick=()=>{state.selectedTransfer=btn.dataset.arrivalId;state.viewMode='llegada';state.tab='registro';renderApp()};
 if(state.tab==='registro')bindRegister();
 if(state.tab==='historial'){const f=document.querySelector('#historySearch');f?.addEventListener('input',()=>{state.search=f.value;document.querySelector('#historyTable').innerHTML=transferTable(state.data.transfers.filter(t=>([t.codigo_personal,workerName(t.codigo_personal),t.modalidad,t.origen,t.destino_previsto,t.vehiculo_codigo].join(' ')).toLowerCase().includes(state.search.toLowerCase())),false)})}
}
function bindRegister(){
 const form=document.querySelector('#markForm'),workerInput=form.elements.worker;
 document.querySelector('#modeSalida').onclick=()=>{state.viewMode='salida';state.selectedTransfer=null;renderApp()};
 document.querySelector('#modeLlegada').onclick=()=>{state.viewMode='llegada';state.selectedTransfer=null;renderApp()};
 document.querySelector('#scanBtn').onclick=startScan;document.querySelector('#stopScanBtn').onclick=stopScan;
 for(const b of document.querySelectorAll('[data-worker-fill]'))b.onclick=()=>{workerInput.value=b.dataset.workerFill;workerInput.dispatchEvent(new Event('input',{bubbles:true}));workerInput.focus()};
 const updateWorker=()=>{const code=workerInput.value.trim().toUpperCase();const person=state.data.personal.find(p=>p.codigo===code);const target=document.querySelector('#workerMatch');target.innerHTML=person?`<span class="success-text">✓ ${esc(person.nombre)} · código validado</span>`:code?'<span class="warning-text">Código aún no encontrado entre los colaboradores de prueba.</span>':'Escribe o escanea un código de prueba.';
  if(state.viewMode==='llegada'){const trans=activeTransfers().find(t=>t.codigo_personal===code);const preview=document.querySelector('#arrivalPreview');preview.innerHTML=trans?`<strong>Traslado encontrado</strong><div>${esc(labelMode(trans.modalidad))}: ${esc(trans.origen)} → ${esc(trans.destino_previsto)}</div><div>Salida: ${esc(timeGT(trans.salida_at))} · ${minuteDiff(trans.salida_at)} minutos transcurridos</div>`:'No hay un traslado activo para este código.';if(trans){form.elements.destino.value=trans.destino_previsto}}
  };
 workerInput.addEventListener('input',updateWorker);
 if(state.viewMode==='salida'){
  const mode=form.elements.modalidad,vehicle=form.elements.vehiculo,origin=form.elements.origen,dest=form.elements.destino;
  const refreshVehicles=()=>{const actCodes=new Set(activeTransfers().map(t=>t.vehiculo_codigo));const list=state.data.vehicles.filter(v=>v.tipo===mode.value&&!actCodes.has(v.codigo));vehicle.innerHTML='<option value="">Seleccionar vehículo</option>'+list.map(v=>`<option value="${esc(v.codigo)}">${esc(v.nombre)} · ${esc(v.codigo)}</option>`).join('');document.querySelector('#vehicleField').hidden=mode.value==='pie'};
  mode.addEventListener('change',refreshVehicles);refreshVehicles();origin.value=PLACES[0];dest.value=PLACES[1];
 }else if(state.selectedTransfer){const t=state.data.transfers.find(t=>t.id===state.selectedTransfer);if(t){form.elements.destino.value=t.destino_previsto}}
 updateWorker();
 form.addEventListener('submit',async(e)=>{e.preventDefault();if(state.busy)return;setBusy(true);try{if(state.viewMode==='salida')await markDeparture(form);else await markArrival(form);state.selectedTransfer=null;stopScan();await reload();}catch(error){showToast(error.message,true)}finally{setBusy(false)}});
}
async function markDeparture(form){
 const code=form.elements.worker.value.trim().toUpperCase(); const mode=form.elements.modalidad.value;const origin=form.elements.origen.value;const dest=form.elements.destino.value;const vehicle=mode==='pie'?null:form.elements.vehiculo.value;
 if(!state.data.personal.some(p=>p.codigo===code&&p.activo))throw new Error('Utiliza un código de personal ficticio válido.');
 if(activeTransfers().some(t=>t.codigo_personal===code))throw new Error('Este colaborador ya tiene un traslado activo.');
 if(origin===dest)throw new Error('La planta de destino debe ser distinta a la de salida.');
 if(!Object.keys(MODES).includes(mode))throw new Error('Modalidad no válida.');
 if(mode!=='pie'&&!vehicle)throw new Error('Selecciona un vehículo disponible.');
 if(vehicle&&activeTransfers().some(t=>t.vehiculo_codigo===vehicle))throw new Error('El vehículo ya se encuentra en traslado.');
 const route=state.data.routes.find(r=>r.modalidad===mode&&r.origen===origin&&r.destino===dest);
 if(!route)throw new Error('No hay una ruta activa para esta combinación.');
 const transfer={codigo_personal:code,modalidad:mode,vehiculo_codigo:vehicle,origen:origin,destino_previsto:dest,minutos_limite:route.minutos_limite,registrado_por:state.authUser.id};
 const rows=await fetchJson('/rest/v1/tc_traslados?select=*',{method:'POST',body:transfer,prefer:'return=representation'});
 const row=rows?.[0];if(!row?.id)throw new Error('La salida no devolvió el identificador del traslado.');
 try{await fetchJson('/rest/v1/tc_marcajes',{method:'POST',body:{traslado_id:row.id,codigo_personal:code,modalidad:mode,vehiculo_codigo:vehicle,tipo:'salida',ubicacion:origin,registrado_por:state.authUser.id}});
  showToast(`Salida registrada: ${code}, ${MODES[mode]}, ${origin} → ${dest}.`);
 }catch(e){throw new Error('El traslado de salida SÍ se guardó, pero falló su marcaje complementario: '+e.message+' (revisar en En curso).')}
}
async function markArrival(form){
 const code=form.elements.worker.value.trim().toUpperCase();const dest=form.elements.destino.value;
 const trans=activeTransfers().find(t=>t.codigo_personal===code);
 if(!trans)throw new Error('No existe un traslado activo para ese código.');
 if(!PLACES.includes(dest))throw new Error('Elige un punto de llegada válido.');
 const now=new Date().toISOString();
 const rows=await fetchJson(`/rest/v1/tc_traslados?id=eq.${encodeURIComponent(trans.id)}&estado=eq.en_curso&select=*`,{method:'PATCH',body:{estado:'finalizado',llegada_at:now,destino_real:dest,cerrado_por:state.authUser.id},prefer:'return=representation'});
 if(!rows?.length)throw new Error('El traslado ya fue cerrado por otro dispositivo. Recarga la pantalla.');
 try{await fetchJson('/rest/v1/tc_marcajes',{method:'POST',body:{traslado_id:trans.id,codigo_personal:code,modalidad:trans.modalidad,vehiculo_codigo:trans.vehiculo_codigo,tipo:'llegada',ubicacion:dest,registrado_por:state.authUser.id}});
   showToast(`Llegada confirmada: ${code}. Tiempo: ${minuteDiff(trans.salida_at,now)} minutos.`);
 }catch(e){throw new Error('La llegada SÍ se guardó, pero falló su marcaje complementario: '+e.message+' (revisar Historial).')}
}
async function startScan(){
 if(state.scanner){stopScan();return}const detector=globalThis.BarcodeDetector;
 if(!detector){showToast('Tu navegador no admite lectura automática de QR/código de barras. Introduce el código manualmente.',true);return}
 if(!navigator.mediaDevices?.getUserMedia){showToast('La cámara requiere HTTPS y permiso del navegador. También puedes escribir el código.',true);return}
 try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const video=document.querySelector('#scannerVideo');if(!video){stream.getTracks().forEach(t=>t.stop());return}video.srcObject=stream;document.querySelector('#scannerArea').hidden=false;await video.play();const reader=new BarcodeDetector();const run=async()=>{if(!state.scanner)return;try{const found=await reader.detect(video);if(found?.length){const match=String(found[0].rawValue||'').trim().toUpperCase();if(state.data.personal.some(p=>p.codigo===match)){const input=document.querySelector('#workerCode');if(input){input.value=match;input.dispatchEvent(new Event('input',{bubbles:true}))}stopScan();showToast('Código leído: '+match);return}document.querySelector('#scanStatus').textContent='Código no reconocido: '+match.slice(0,45)}}catch{}if(state.scanner)state.scanner.timer=setTimeout(run,420)};state.scanner={stream,timer:null};run();}
 catch(e){stopScan();showToast('No fue posible abrir la cámara. Revisa permisos del navegador o escribe el código.',true)}
}
function stopScan(){const s=state.scanner;state.scanner=null;if(s){clearTimeout(s.timer);s.stream?.getTracks().forEach(t=>t.stop())}const a=document.querySelector('#scannerArea');if(a)a.hidden=true;const v=document.querySelector('#scannerVideo');if(v)v.srcObject=null}
function startPolling(){clearInterval(state.poll);clearInterval(state.clock);state.poll=setInterval(()=>{if(state.profile&&!state.busy&&document.visibilityState==='visible')reload({quiet:true})},12000);state.clock=setInterval(()=>{if(state.profile&&!state.busy&&['resumen','activos'].includes(state.tab))renderApp()},60000)}
async function init(){if(!PROJECT_URL || !PUBLISHABLE_KEY){app.innerHTML='<main class="boot"><h1>TATA Control de Transportes V7</h1><p>Conexion a Supabase pendiente por revision de seguridad. Esta version contiene solo el codigo de la aplicacion.</p></main>';return;}state.session=readSession();if(!state.session){renderLogin();return}try{await verifyIdentity();await reload();startPolling()}catch(e){setSession(null);state.profile=null;renderLogin(e.message)}}
init();