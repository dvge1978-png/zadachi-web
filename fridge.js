/* =====================================================================
   «Холодильник» — отдельный модуль. Свои таблицы (kitchens, kitchen_members,
   fridge_items, fridge_log, fridge_shop, fridge_prefs), свои экраны и настройки.
   С задачами не связан: только общий вход и внешний вид.
   ===================================================================== */
(function(){
'use strict';
function boot(){
var C=window.__core;if(!C||window.FRIDGE)return;
var sb=C.sb,I=C.I,esc=C.esc,toast=C.toast,T=C.T,addDays=C.addDays,diff=C.diff;

/* ---------- справочники ---------- */
var DEF_PLACES=['Холодильник','Морозилка','Шкаф'];
var DEF_APPL=['Аэрогриль','Плита','Тостер','Вафельница'];
var MORE_APPL=['Микроволновка','Мультиварка','Блендер','Электрочайник','Сэндвичница','Пароварка','Гриль-сковорода'];
var CATS=['Молочное','Мясо и рыба','Овощи и фрукты','Хлеб','Крупы и макароны','Соусы','Напитки','Готовое','Сладкое','Другое'];
var STATES=[['full','Целая'],['open','Открыта'],['half','Половина'],['quarter','Четверть'],['low','Почти нет']];
var STATE_TXT={full:'',open:'открыто',half:'половина',quarter:'четверть',low:'почти нет'};
var UNITS=['шт','уп','г','кг','мл','л'];
// [шаблон, категория, дней хранения, дней после вскрытия]
var KNOW=[
 [/молок/, 'Молочное',7,3],[/кефир|ряженк|простокваш|снежок|айран/,'Молочное',7,2],[/йогурт/,'Молочное',14,2],[/творог|творожн/,'Молочное',5,2],
 [/сметан/,'Молочное',7,3],[/сливк/,'Молочное',10,3],[/сыр(?!ок)/,'Молочное',21,7],[/сырок/,'Молочное',10,1],[/масло сливоч|сливочное масло/,'Молочное',30,14],
 [/яйц|яиц/,'Молочное',25,null],[/куриц|курин|филе|окорочк|крыл|бедр/,'Мясо и рыба',3,null],[/фарш/,'Мясо и рыба',2,null],
 [/говяд|свинин|баранин|мяс|стейк|котлет/,'Мясо и рыба',3,null],[/рыб|лосос|сёмг|семг|форел|треск|минта|креветк/,'Мясо и рыба',2,null],
 [/колбас|ветчин|бекон|сосиск|сардельк|салями|буженин/,'Мясо и рыба',10,5],[/хлеб|батон|багет|лаваш|булк|булочк/,'Хлеб',4,null],
 [/салат|зелен|укроп|петрушк|кинз|шпинат|руккол/,'Овощи и фрукты',4,null],[/огур|помидор|томат|перец|кабачк|баклажан|брокол|капуст|морков|свёкл|свекл|лук|картоф|чеснок|гриб|шампиньон/,'Овощи и фрукты',7,null],
 [/яблок|груш|банан|апельсин|мандарин|лимон|виноград|ягод|клубник|киви|авокадо|персик/,'Овощи и фрукты',7,null],
 [/сок|морс|компот/,'Напитки',30,2],[/вод[аы]|лимонад|кола|газиров/,'Напитки',null,null],
 [/кетчуп|майонез|соус|горчиц|песто|аджик/,'Соусы',null,30],[/рис|греч|макарон|паст[аы]|спагетти|овсян|круп|мук[аи]/,'Крупы и макароны',null,null],
 [/шоколад|печень|конфет|торт|пирожн|мороженое/,'Сладкое',null,null],[/пельмен|вареник|наггетс|пицц|блин/,'Готовое',null,null]
];
function know(name){var n=String(name||'').toLowerCase();for(var i=0;i<KNOW.length;i++)if(KNOW[i][0].test(n))return{cat:KNOW[i][1],shelf:KNOW[i][2],open:KNOW[i][3]};return null;}

/* ---------- состояние ---------- */
var F={state:'idle',err:'',kitchens:[],kitchen:null,members:[],items:[],shop:[],log:[],prefs:{},tab:'items',place:'all',q:'',quick:''};
function rr(){if(C.UI.view==='fridge'||(C.UI.sheet&&String(C.UI.sheet.type).indexOf('fr-')===0))C.render();}
function isMissing(e){var m=String((e&&e.message)||'')+' '+String((e&&e.code)||'');return /does not exist|PGRST205|42P01|Could not find the table|schema cache/i.test(m);}
function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function kset(){return (F.kitchen&&F.kitchen.settings)||{};}
function places(){var p=kset().places;return p&&p.length?p:DEF_PLACES.slice();}
function appliances(){var a=kset().appliances;return a?a:DEF_APPL.slice();}
function myPrefs(){return F.prefs[C.ME]||{user_id:C.ME,dislikes:'',allergies:'',settings:{}};}
function pset(){return myPrefs().settings||{};}
function warnDays(){var w=pset().warn;return w==null?2:+w;}
function num(x){var n=Math.round(x*1000)/1000;return String(n).replace('.',',');}
function pickKey(){return 'fridge-kitchen-'+C.ME;}

async function load(){
  if(!C.ME)return;if(F.state==='loading')return;F.state='loading';
  try{
    var ks=await C.q(sb.from('kitchens').select('*').order('created_at'));
    F.kitchens=ks;var pick=null;try{pick=localStorage.getItem(pickKey());}catch(e){}
    F.kitchen=ks.filter(function(k){return k.id===pick;})[0]||ks[0]||null;
    var pr=await C.q(sb.from('fridge_prefs').select('*'));F.prefs={};pr.forEach(function(p){F.prefs[p.user_id]=p;});
    if(F.kitchen){var id=F.kitchen.id;
      var r=await Promise.all([
        C.q(sb.from('fridge_items').select('*').eq('kitchen_id',id).order('created_at')),
        C.q(sb.from('fridge_shop').select('*').eq('kitchen_id',id).order('created_at')),
        C.q(sb.from('kitchen_members').select('*').eq('kitchen_id',id)),
        C.q(sb.from('fridge_log').select('*').eq('kitchen_id',id).order('created_at',{ascending:false}).limit(150))
      ]);
      F.items=r[0];F.shop=r[1];F.members=r[2];F.log=r[3];
    }else{F.items=[];F.shop=[];F.members=[];F.log=[];}
    F.state='ok';F.err='';subscribe();
  }catch(e){F.state='error';F.err=isMissing(e)?'nodb':(e.message||'ошибка');}
  rr();
}
var reloadT=null;function reloadSoon(){clearTimeout(reloadT);reloadT=setTimeout(function(){F.state='ok';load();},500);}
var ch=null;
function subscribe(){
  if(ch||!sb.channel)return;
  try{ch=sb.channel('fridge-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'fridge_items'},reloadSoon)
    .on('postgres_changes',{event:'*',schema:'public',table:'fridge_shop'},reloadSoon)
    .on('postgres_changes',{event:'*',schema:'public',table:'kitchen_members'},reloadSoon)
    .on('postgres_changes',{event:'*',schema:'public',table:'kitchens'},reloadSoon)
    .subscribe();}catch(e){}
}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&C.ME&&F.state==='ok')reloadSoon();});

/* ---------- сроки и количество ---------- */
function expInfo(it){
  if(!it.expires)return null;var d=diff(it.expires,T());
  if(d<0)return{cls:'over',text:'просрочено'+(d===-1?' со вчера':' с '+C.fmtDM(it.expires)),d:d};
  if(d===0)return{cls:'over',text:'сегодня последний день',d:d};
  if(d===1)return{cls:'soon',text:'до завтра',d:d};
  if(d<=warnDays())return{cls:'soon',text:'ещё '+d+' '+C.plural(d,'день','дня','дней'),d:d};
  return{cls:'',text:'до '+C.fmtDM(it.expires),d:d};
}
function soon(it){var e=expInfo(it);return !!e&&e.d<=warnDays();}
function qtyText(it){var a=[];if(it.qty!=null)a.push(num(+it.qty)+' '+it.unit);if(STATE_TXT[it.state])a.push(STATE_TXT[it.state]);else if(it.qty==null)a.push('целая');return a.join(' · ');}
function counted(it){return it.qty!=null;}
function stepFor(unit){return unit==='г'||unit==='мл'?[50,100,250]:unit==='кг'||unit==='л'?[0.25,0.5,1]:[1,2];}

/* ---------- запись в базу ---------- */
function logIt(name,action,amount){
  if(!F.kitchen)return;var row={kitchen_id:F.kitchen.id,user_id:C.ME,item_name:name,action:action,amount:amount||''};
  sb.from('fridge_log').insert(row).select().single().then(function(r){if(r&&r.data){F.log.unshift(r.data);if(F.tab==='log')rr();}},function(){});
}
async function addItem(d,silent){
  var k=know(d.name)||{};
  var row={kitchen_id:F.kitchen.id,name:C.cap(String(d.name).trim()).slice(0,120),category:d.category||k.cat||'',place:d.place||places()[0],
    qty:d.qty==null||d.qty===''?null:Math.max(0,+d.qty),unit:d.unit||'шт',state:d.state||'full',expires:d.expires||null,
    open_days:d.open_days==null||d.open_days===''?(k.open==null?null:k.open):+d.open_days,opened_on:d.opened_on||null,bought_on:d.bought_on||T(),notes:d.notes||'',added_by:C.ME,updated_by:C.ME};
  try{var r=await C.q(sb.from('fridge_items').insert(row).select().single());F.items.push(r);logIt(r.name,'add',r.qty!=null?num(+r.qty)+' '+r.unit:'');if(!silent)rr();return r;}
  catch(e){C.err(e);}
}
async function patchItem(it,f,logAction,amount){
  var before=JSON.parse(JSON.stringify(it));Object.assign(it,f,{updated_by:C.ME});rr();
  try{var r=await C.q(sb.from('fridge_items').update(Object.assign({},f,{updated_by:C.ME})).eq('id',it.id).select().single());Object.assign(it,r);if(logAction)logIt(it.name,logAction,amount);rr();}
  catch(e){Object.assign(it,before);rr();C.err(e);}
  return before;
}
function restoreFields(b){var f={};['name','category','place','qty','unit','state','expires','open_days','opened_on','bought_on','notes'].forEach(function(k){f[k]=b[k];});return f;}
async function finish(it,action){
  var idx=F.items.indexOf(it);if(idx<0)return;F.items.splice(idx,1);if(C.UI.sheet&&String(C.UI.sheet.type).indexOf('fr-')===0)C.closeSheet();rr();
  try{await C.q(sb.from('fridge_items').delete().eq('id',it.id));}catch(e){F.items.splice(idx,0,it);rr();return C.err(e);}
  logIt(it.name,action,'');
  var shopRow=null,exists=F.shop.some(function(s){return !s.done&&norm(s.name)===norm(it.name);});
  if(!exists){
    var shelf=it.expires&&it.bought_on&&diff(it.expires,it.bought_on)>0?diff(it.expires,it.bought_on):null;
    try{shopRow=await C.q(sb.from('fridge_shop').insert({kitchen_id:F.kitchen.id,name:it.name,qty:it.unit==='шт'||it.unit==='уп'?1:null,unit:it.unit,place:it.place,category:it.category,shelf_days:shelf,open_days:it.open_days,source:'auto',added_by:C.ME}).select().single());F.shop.push(shopRow);rr();}catch(e){}
  }
  toast((action==='toss'?'Выброшено: ':'Закончилось: ')+it.name+(shopRow?'. Добавил в покупки':''),async function(){
    var c=JSON.parse(JSON.stringify(it));delete c.created_at;delete c.updated_at;
    try{var back=await C.q(sb.from('fridge_items').insert(c).select().single());F.items.push(back);}catch(e){C.err(e);}
    if(shopRow){F.shop=F.shop.filter(function(s){return s.id!==shopRow.id;});sb.from('fridge_shop').delete().eq('id',shopRow.id).then(function(){},function(){});}
    rr();
  });
}
async function useAmount(it,amount){
  if(!counted(it))return;var nq=Math.round((+it.qty-amount)*1000)/1000;
  if(nq<=0){return finish(it,'finish');}
  var b=await patchItem(it,{qty:nq,state:it.state==='full'?'open':it.state},'use','−'+num(amount)+' '+it.unit);
  toast(it.name+': осталось '+num(nq)+' '+it.unit,function(){patchItem(it,{qty:b.qty,state:b.state});});
}
async function openItem(it){
  var k=know(it.name)||{};var od=it.open_days!=null?it.open_days:k.open;var f={state:'open',opened_on:T()};
  if(od!=null){f.open_days=od;var ne=addDays(T(),od);if(!it.expires||ne<it.expires)f.expires=ne;}
  var b=await patchItem(it,f,'open','');
  toast(f.expires&&f.expires!==b.expires?'Открыто. Срок теперь до '+C.fmtDM(f.expires):'Отмечено: открыто',function(){patchItem(it,restoreFields(b));});
}
async function setState(it,st){var b=await patchItem(it,{state:st},'use',STATE_TXT[st]||'');toast(it.name+': '+(STATE_TXT[st]||'целая'),function(){patchItem(it,{state:b.state});});}

/* ---------- разбор фразы: «молоко 2 шт до 5.11», «купил 2 молока и курицу» ---------- */
var MONTHS=['январ','феврал','март','апрел','ма','июн','июл','август','сентябр','октябр','ноябр','декабр'];
var WDG=['понедельник','вторник','сред','четверг','пятниц','суббот','воскресень'];
var NUMW={'одну':1,'один':1,'одна':1,'одно':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,'шесть':6,'семь':7,'восемь':8,'девять':9,'десять':10,'пару':2,'пара':2};
var NOM={'яиц':'яйца','яйцо':'яйцо','молока':'молоко','мяса':'мясо','сыра':'сыр','хлеба':'хлеб','масла':'масло','пива':'пиво','вина':'вино','кефира':'кефир','творога':'творог','сока':'сок','риса':'рис',
 'яблок':'яблоки','яблока':'яблоко','огурца':'огурец','огурцов':'огурцы','перца':'перец','перцев':'перцы','сырков':'сырки','сырка':'сырок','лука':'лук','чеснока':'чеснок','укропа':'укроп','салата':'салат','фарша':'фарш','лаваша':'лаваш','кетчупа':'кетчуп','майонеза':'майонез','соуса':'соус','чая':'чай','кофе':'кофе','сосисок':'сосиски','сарделек':'сардельки','котлет':'котлеты','конфет':'конфеты','груш':'груши','слив':'сливы','булок':'булки','морковок':'морковки','картофелин':'картофелины','бутербродов':'бутерброды'};
function nomWord(w,mode){var lw=w.toLowerCase().replace(/ё/g,'е'),r=null;
  if(NOM[lw])r=NOM[lw];
  else if(mode==='many'&&/^.{3,}ов$/.test(lw))r=lw.replace(/ов$/,'ы');
  else if(mode==='few'&&/^.{3,}[бвдзклмнпрстфх]а$/.test(lw))r=lw.slice(0,-1);
  else if((mode==='few'||mode==='unit')&&/^.{2,}[кгх]и$/.test(lw))r=lw.slice(0,-1)+'а';
  else if((mode==='few'||mode==='unit')&&/^.{2,}ы$/.test(lw))r=lw.slice(0,-1)+'а';
  if(!r)return w;return w.charAt(0)===w.charAt(0).toUpperCase()?r.charAt(0).toUpperCase()+r.slice(1):r;}
function nomName(name,qty,hadUnit){var ws=name.split(' ');if(!ws[0])return name;var mode=hadUnit?'unit':qty==null?'':qty>=2&&qty<=4&&Math.floor(qty)===qty?'few':qty>=5?'many':'';
  if(!mode&&!NOM[ws[0].toLowerCase()])return name;
  // меняем первое существительное (пропускаем прилагательные на -ого/-ой/-ых/-ые)
  var adj=[];for(var i=0;i<ws.length;i++){if(/(ого|его|ой|ей|ых|их|ые|ие)$/i.test(ws[i])&&i<ws.length-1){adj.push(i);continue;}ws[i]=nomWord(ws[i],mode||'none');
    var neu=/[оеё]$/i.test(ws[i]);adj.forEach(function(j){ws[j]=ws[j].replace(/(ого|его)$/i,neu?'ое':'ый');});break;}
  return ws.join(' ');}
function unitNorm(u){u=(u||'').toLowerCase();if(!u)return '';if(/^шт|^штук/.test(u))return 'шт';if(/^кг|^кило/.test(u))return 'кг';if(/^мл/.test(u))return 'мл';if(/^г/.test(u))return 'г';if(/^л/.test(u))return 'л';return 'уп';}
function parseOne(src){
  var t=' '+src.replace(/(\d),(\d)/g,'$1.$2')+' ',d={name:'',qty:null,unit:'',expires:null,place:null},m;
  t=t.replace(/\s(полкило)\s/i,' 0.5 кг ').replace(/\s(пол[\s-]?литра|поллитра)\s/i,' 0.5 л ').replace(/\s(десяток|десяток яиц)\s/i,function(x){return /яиц/.test(x)?' 10 шт яиц ':' 10 шт ';}).replace(/\sдюжин[ау]\s/i,' 12 шт ');
  t=t.replace(/\s(одну|один|одна|одно|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|пару|пара)\s/gi,function(x,w){return ' '+NUMW[w.toLowerCase()]+' ';});
  m=t.match(/\sдо\s+(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?(?=\s)/i);
  if(m){var y=m[3]?(m[3].length===2?2000+(+m[3]):+m[3]):new Date().getFullYear();var k=y+'-'+C.pad(+m[2])+'-'+C.pad(+m[1]);if(!m[3]&&diff(k,T())<-60)k=(y+1)+k.slice(4);d.expires=k;t=t.replace(m[0],' ');}
  if(!d.expires){m=t.match(/\sдо\s+(\d{1,2})\s+([а-яё]+)(?=\s)/i);if(m){for(var i=0;i<12;i++){if(m[2].toLowerCase().indexOf(MONTHS[i])===0&&(i!==4||/^ма[яй]/i.test(m[2]))){var yy=new Date().getFullYear(),kk=yy+'-'+C.pad(i+1)+'-'+C.pad(+m[1]);if(diff(kk,T())<-60)kk=(yy+1)+kk.slice(4);d.expires=kk;t=t.replace(m[0],' ');break;}}}}
  if(!d.expires){m=t.match(/\sдо\s+(сегодня|завтра|послезавтра)(?=\s)/i);if(m){d.expires=addDays(T(),{'сегодня':0,'завтра':1,'послезавтра':2}[m[1].toLowerCase()]);t=t.replace(m[0],' ');}}
  if(!d.expires){m=t.match(/\sдо\s+([а-яё]+)(?=\s)/i);if(m){for(var j=0;j<7;j++){if(m[1].toLowerCase().indexOf(WDG[j])===0){var x=T(),g=0;do{x=addDays(x,1);}while(C.dow(x)!==j&&g++<8);d.expires=x;t=t.replace(m[0],' ');break;}}}}
  if(!d.expires){m=t.match(/\s(?:на|ещё|еще)\s+(\d+)\s+(дн[яей]*|день|недел[иью]*)(?=\s)/i);if(m){d.expires=addDays(T(),(+m[1])*(/^нед/i.test(m[2])?7:1));t=t.replace(m[0],' ');}}
  places().forEach(function(p){if(d.place)return;var st=norm(p).slice(0,5);var re=new RegExp('\\s(?:в|во|на)?\\s?'+st+'[а-яё]*(?=\\s)','i');if(st.length>=4&&re.test(t)){d.place=p;t=t.replace(re,' ');}});
  m=t.match(/\s(\d+(?:\.\d+)?)\s*(штук[аи]?|шт|кг|килограмм[аов]*|кило|мл|миллилитр[аов]*|граммов|грамм[а]?|гр|г|литр[аов]*|л|упаковк[аи]|упаковок|уп|пачк[аи]|пачек|бутылк[аи]|бутылок|банк[аи]|банок|пакет[аов]*)?(?=[\s.])/i);
  var hadUnit=false;if(!m){var mu=t.match(/^\s(пачк[аиу]|бутылк[аиу]|банк[аиу]|упаковк[аиу]|пакет|коробк[аиу])\s/i);if(mu){d.qty=1;d.unit='уп';hadUnit=true;t=t.replace(mu[0],' ');}}
  if(m){d.qty=+m[1];d.unit=unitNorm(m[2])||'шт';hadUnit=!!m[2]&&d.unit!=='шт';t=t.replace(m[0],' ');}
  d.name=nomName(t.replace(/[.;]+/g,' ').replace(/\s+/g,' ').trim(),d.qty,hadUnit);
  return d;
}
function parseItems(text){
  var s=String(text||'').trim().replace(/^(?:я\s+)?(?:купил[аи]?|купили|добавь(?:те)?|добавил[аи]?|положил[аи]?|положи|заказал[аи]?|привезли|есть)\s+/i,'');
  s=s.replace(/(\d),(\d)/g,'$1.$2');
  return s.split(/\s*,\s*|\s+и\s+|\s*;\s*/).map(function(p){return p.trim();}).filter(Boolean).map(parseOne).filter(function(d){return d.name;});
}
function withDefaults(d){var k=know(d.name);if(!d.expires&&k&&k.shelf&&d.place!=='Морозилка'&&d.place!=='Шкаф'){d.expires=addDays(T(),k.shelf);d._est=true;}return d;}
function findItem(phrase){
  var words=norm(phrase).split(' ').filter(function(w){return w.length>=3&&!/^\d/.test(w)&&['весь','всю','все','всё','половину','четверть','немного'].indexOf(w)<0;});
  if(!words.length)return null;var best=null,bs=0;
  words=words.map(function(w){return norm(nomWord(w,'none'));});
  function same(w,x){var p=0;while(p<w.length&&p<x.length&&w[p]===x[p])p++;return p>=3&&p>=Math.min(w.length,x.length)-2;}
  F.items.forEach(function(it){var iw=norm(it.name).split(' '),sc=0;words.forEach(function(w){iw.forEach(function(x){if(same(w,x))sc++;});});if(sc>bs||(sc===bs&&sc>0&&best&&(it.expires||'9')<(best.expires||'9'))){bs=sc;best=it;}});
  return bs>0?best:null;
}
async function addFromText(text,fromVoice){
  var list=parseItems(text).map(withDefaults);if(!list.length){toast('Напиши, что добавить, например «молоко 2 шт до 5.11»');return;}
  var names=[],est=false;
  for(var i=0;i<list.length;i++){var r=await addItem(list[i],true);if(r){names.push(r.name);if(list[i]._est)est=true;}}
  rr();if(names.length)toast('Добавлено: '+names.join(', ')+(est?'. Срок примерный, можно поправить':''));
}
async function voice(t){
  var s=t.trim(),m,it;
  if((m=s.match(/^(?:я\s+)?(?:выкинул[аи]?|выкинули|выбросил[аи]?|выбросили)\s+(.+)/i))){it=findItem(m[1]);if(!it)return toast('Не нашёл «'+m[1]+'» в холодильнике');return finish(it,'toss');}
  if((m=s.match(/^(.+?)\s+(?:закончил(?:ся|ась|ось|ись)|кончил(?:ся|ась|ось|ись))$/i))||(m=s.match(/^(?:закончил(?:ся|ась|ось|ись)|кончил(?:ся|ась|ось|ись))\s+(.+)/i))){it=findItem(m[1]);if(!it)return toast('Не нашёл «'+m[1]+'» в холодильнике');return finish(it,'finish');}
  if((m=s.match(/^(?:я\s+)?(?:открыл[аи]?|открыли)\s+(.+)/i))){it=findItem(m[1]);if(!it)return toast('Не нашёл «'+m[1]+'» в холодильнике');return openItem(it);}
  if((m=s.match(/^(?:я\s+)?(?:съел[аи]?|съели|выпил[аи]?|выпили|потратил[аи]?|потратили|использовал[аи]?|использовали|доел[аи]?|доели|допил[аи]?|допили)\s+(.+)/i))){
    var rest=m[1],all=/^(?:доел|доели|допил|допили|доела|допила)/i.test(s)||/^(весь|всю|все|всё)\s/i.test(rest);it=findItem(rest);
    if(!it)return toast('Не нашёл «'+rest+'» в холодильнике');
    if(all)return finish(it,'finish');
    if(/половин/i.test(rest))return setState(it,'half');
    if(/четверт/i.test(rest))return setState(it,'quarter');
    var p=parseOne(rest);
    if(counted(it)){var amt=p.qty!=null?p.qty:(it.unit==='шт'||it.unit==='уп'?1:null);
      if(p.qty!=null&&p.unit&&p.unit!==it.unit){if(p.unit==='г'&&it.unit==='кг')amt=p.qty/1000;else if(p.unit==='кг'&&it.unit==='г')amt=p.qty*1000;else if(p.unit==='мл'&&it.unit==='л')amt=p.qty/1000;else if(p.unit==='л'&&it.unit==='мл')amt=p.qty*1000;}
      if(amt!=null)return useAmount(it,amt);}
    C.UI.sheet={type:'fr-item',id:it.id};C.renderSheet(true);return;
  }
  return addFromText(s,true);
}

/* ---------- элементы интерфейса ---------- */
function chips(label,opts,cur,key,hint,extra){
  return '<div><div class="gl">'+label+'</div><div class="chips">'+opts.map(function(o){return '<button class="chip'+(String(o[0])===String(cur)?' on':'')+'" data-a="frSet" data-k="'+key+'" data-v="'+esc(o[0])+'">'+o[1]+'</button>';}).join('')+(extra||'')+'</div>'+(hint?'<div class="gh">'+hint+'</div>':'')+'</div>';
}
function sec(title,n,cls){return '<div class="sec'+(cls?' '+cls:'')+'"><h2>'+esc(title)+'</h2>'+(n?'<span class="n">'+n+'</span>':'')+'</div>';}
function row(it,showPlace){
  var e=expInfo(it),m=[],qt=qtyText(it);
  if(qt)m.push('<span class="tm">'+esc(qt)+'</span>');
  if(e)m.push('<span class="'+e.cls+'">'+esc(e.text)+'</span>');
  if(showPlace)m.push('<span>'+esc(it.place)+'</span>');
  var quick=counted(it)?'<button class="btn2 fq" data-a="frMinus" data-id="'+it.id+'" aria-label="Взять '+num(stepFor(it.unit)[0])+' '+esc(it.unit)+': '+esc(it.name)+'">−'+num(stepFor(it.unit)[0])+'</button>':'';
  return '<div class="task frow"><button class="tb" data-a="frOpen" data-id="'+it.id+'"><span class="tt">'+esc(it.name)+'</span>'+(m.length?'<span class="meta">'+m.join('')+'</span>':'')+'</button>'+quick+'</div>';
}
function sortItems(a,b){var x=a.expires||'9999',y=b.expires||'9999';if(x!==y)return x<y?-1:1;return a.name.localeCompare(b.name,'ru');}
function quickForm(){
  return '<form class="quick" id="frq" autocomplete="off"><span class="muted">'+I('plus')+'</span><input id="frin" placeholder="Добавить: молоко 2 шт до 5.11" aria-label="Добавить продукт" value="'+esc(F.quick)+'">'+C.micBtn('fr')+'<button class="iconbtn" type="button" data-a="frAdd" aria-label="Добавить подробно">'+I('edit')+'</button></form>';
}
function tabs(){
  var n=F.items.length,s=F.shop.filter(function(x){return !x.done;}).length;
  var t=[['items','Продукты'+(n?' '+n:'')],['shop','Покупки'+(s?' '+s:'')],['log','История']];
  return '<div class="tabs" role="tablist">'+t.map(function(x){return '<button role="tab" aria-selected="'+(F.tab===x[0])+'" class="'+(F.tab===x[0]?'on':'')+'" data-a="frTab" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
}
function itemsView(){
  var h='',list=F.items.slice(),qq=norm(F.q);
  if(qq)list=list.filter(function(it){return norm(it.name).indexOf(qq)>=0;});
  if(F.items.length>10)h+='<div class="search">'+I('search')+'<input id="frsearch" type="search" placeholder="Найти продукт" aria-label="Найти продукт" value="'+esc(F.q)+'"></div>';
  var pl=places();var counts={};F.items.forEach(function(it){counts[it.place]=(counts[it.place]||0)+1;});
  var extra=Object.keys(counts).filter(function(p){return pl.indexOf(p)<0;});
  h+='<div class="chipsrow"><button class="fchip'+(F.place==='all'?' on':'')+'" data-a="frPlace" data-v="all">Все</button>'+pl.concat(extra).map(function(p){return '<button class="fchip'+(F.place===p?' on':'')+'" data-a="frPlace" data-v="'+esc(p)+'">'+esc(p)+(counts[p]?' <span class="muted">'+counts[p]+'</span>':'')+'</button>';}).join('')+'</div>';
  if(F.place!=='all')list=list.filter(function(it){return it.place===F.place;});
  if(!F.items.length)return h+'<div class="empty">Пока пусто. Добавь продукты строкой выше: «молоко 2 шт до 5.11», «курица 1 кг на 3 дня», «сыр, хлеб и 10 яиц» — или нажми микрофон и скажи.</div>';
  if(!list.length)return h+'<div class="empty">'+(qq?'Ничего не нашлось.':'Здесь пусто.')+'</div>';
  var hot=list.filter(soon).sort(sortItems),rest=list.filter(function(it){return !soon(it);});
  if(hot.length){h+=sec('Скоро испортится',String(hot.length),'warn');hot.forEach(function(it){h+=row(it,F.place==='all');});}
  if(F.place==='all'){pl.concat(extra).forEach(function(p){var g=rest.filter(function(it){return it.place===p;}).sort(sortItems);if(!g.length)return;h+=sec(p,String(g.length));g.forEach(function(it){h+=row(it,false);});});}
  else if(rest.length){h+=sec(F.place,String(rest.length));rest.sort(sortItems).forEach(function(it){h+=row(it,false);});}
  return h;
}
function shopView(){
  var open=F.shop.filter(function(s){return !s.done;}),done=F.shop.filter(function(s){return s.done;}).sort(function(a,b){return (b.done_at||'')<(a.done_at||'')?-1:1;});
  var h='<form class="quick" id="frshop" autocomplete="off" style="margin-top:14px"><span class="muted">'+I('plus')+'</span><input id="frshopin" placeholder="Добавить в покупки: сметана, 2 молока" aria-label="Добавить в покупки"><button class="iconbtn" aria-label="Добавить">'+I('check')+'</button></form>';
  if(!open.length)h+='<div class="empty">Список покупок пуст. Когда продукт закончится, он появится здесь сам.</div>';
  else{h+=sec('Купить',String(open.length));open.forEach(function(s){var m=[];if(s.qty!=null)m.push('<span class="tm">'+num(+s.qty)+' '+esc(s.unit)+'</span>');if(s.source==='auto')m.push('<span>закончилось</span>');if(s.source==='recipe')m.push('<span>для рецепта</span>');if(s.added_by&&s.added_by!==C.ME)m.push('<span>'+esc(C.pname(s.added_by))+'</span>');
    h+='<div class="task"><button class="chk" data-a="frBuy" data-id="'+s.id+'" aria-label="Купил: '+esc(s.name)+'"><span></span></button><div class="tb"><span class="tt">'+esc(s.name)+'</span>'+(m.length?'<span class="meta">'+m.join('')+'</span>':'')+'</div><button class="iconbtn" data-a="frShopDel" data-id="'+s.id+'" aria-label="Убрать из покупок: '+esc(s.name)+'">'+I('x')+'</button></div>';});}
  if(done.length){h+='<div class="sec"><h2>Куплено</h2><span class="n"><button class="link" data-a="frShopClear">Очистить</button></span></div>';done.slice(0,15).forEach(function(s){h+='<div class="task"><button class="chk on" data-a="frUnbuy" data-id="'+s.id+'" aria-label="Вернуть в покупки: '+esc(s.name)+'"><span>'+I('check')+'</span></button><div class="tb"><span class="tt done">'+esc(s.name)+'</span></div></div>';});}
  return h;
}
var ACT={add:'добавил(а)',use:'взял(а)',open:'открыл(а)',finish:'доел(а)',toss:'выбросил(а)',buy:'купил(а)',edit:'изменил(а)'};
function logView(){
  if(!F.log.length)return '<div class="empty">Здесь будет видно, кто что добавил, взял и выбросил.</div>';
  var days={},order=[];F.log.forEach(function(l){var d=String(l.created_at).slice(0,10);var loc=new Date(l.created_at);d=loc.getFullYear()+'-'+C.pad(loc.getMonth()+1)+'-'+C.pad(loc.getDate());if(!days[d]){days[d]=[];order.push(d);}days[d].push(l);});
  var h='';order.forEach(function(d){var dd=diff(d,T());h+='<div class="dday">'+(dd===0?'Сегодня':dd===-1?'Вчера':C.fmtDM(d))+'</div>';
    days[d].forEach(function(l){h+='<div class="drow"><span class="av">'+esc(C.pname(l.user_id).slice(0,1))+'</span><span><b style="font-weight:600">'+esc(C.pname(l.user_id))+'</b> '+(ACT[l.action]||l.action)+' '+esc(l.item_name)+(l.amount?' <span class="muted">'+esc(l.amount)+'</span>':'')+'</span><span class="at">'+new Date(l.created_at).toTimeString().slice(0,5)+'</span></div>';});});
  return h;
}
function view(){
  var h='<div class="top"><div><div class="date">'+C.fmtLong(T())+'</div><h1 class="dh">Холодильник</h1></div><button class="iconbtn" data-a="frSettings" aria-label="Настройки холодильника">'+I('gear')+'</button></div>';
  if(F.state==='idle'){load();return h+'<div class="empty">Загружаю…</div>';}
  if(F.state==='loading'&&!F.kitchen&&!F.err)return h+'<div class="empty">Загружаю…</div>';
  if(F.err==='nodb')return h+'<div class="empty">Холодильник ещё не подключён к базе. Запусти в Supabase скрипт zadachi-baza-6-holodilnik и обнови страницу.</div>';
  if(F.err)return h+'<div class="empty">Не удалось загрузить: '+esc(F.err)+'<br><button class="link" data-a="frReload">Повторить</button></div>';
  if(!F.kitchen)return h+'<div class="fields" style="margin-top:18px;padding:18px;display:flex;flex-direction:column;gap:12px"><div style="font-size:16px;line-height:1.5">Здесь можно вести учёт продуктов: что есть, сколько осталось и до какого числа годно. Закончившееся само попадает в список покупок.</div><div class="muted" style="font-size:14px;line-height:1.5">Холодильник общий: создай его и добавь партнёра в настройках холодильника. Если партнёр уже создал его, попроси добавить тебя — он появится здесь сам.</div><button class="btn" data-a="frCreate">'+I('plus')+'Создать холодильник</button></div>';
  h+=quickForm()+tabs();
  h+=F.tab==='shop'?shopView():F.tab==='log'?logView():itemsView();
  return h;
}
function bindMain(){
  var f=document.getElementById('frq');
  if(f&&!f.__b){f.__b=1;var i=document.getElementById('frin');i.addEventListener('input',function(){F.quick=i.value;});
    f.addEventListener('submit',function(e){e.preventDefault();var v=i.value.trim();if(!v)return;F.quick='';i.value='';addFromText(v);});}
  var s=document.getElementById('frshop');
  if(s&&!s.__b){s.__b=1;s.addEventListener('submit',function(e){e.preventDefault();var inp=document.getElementById('frshopin'),v=inp.value.trim();if(!v)return;inp.value='';addShop(v).then(function(){var n=document.getElementById('frshopin');if(n)n.focus();});});}
  var sr=document.getElementById('frsearch');
  if(sr&&!sr.__b){sr.__b=1;sr.addEventListener('input',function(){F.q=sr.value;var pos=sr.selectionStart;C.render();var n=document.getElementById('frsearch');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}});}
}

/* ---------- покупки ---------- */
async function addShop(text){
  var list=parseItems(text);var n=0;
  for(var i=0;i<list.length;i++){var d=list[i],k=know(d.name)||{};
    try{var r=await C.q(sb.from('fridge_shop').insert({kitchen_id:F.kitchen.id,name:C.cap(d.name).slice(0,120),qty:d.qty,unit:d.unit||'шт',place:d.place||places()[0],category:k.cat||'',shelf_days:k.shelf||null,open_days:k.open==null?null:k.open,source:'manual',added_by:C.ME}).select().single());F.shop.push(r);n++;}catch(e){C.err(e);}}
  rr();if(n)toast('В покупках: '+list.map(function(d){return C.cap(d.name);}).join(', '));
}
async function patchShop(s,f){var b=Object.assign({},s);Object.assign(s,f);rr();try{var r=await C.q(sb.from('fridge_shop').update(f).eq('id',s.id).select().single());Object.assign(s,r);rr();}catch(e){Object.assign(s,b);rr();C.err(e);}}

/* ---------- окна ---------- */
function itemSheet(it){
  var e=expInfo(it),rows=[['Количество',qtyText(it)||'—'],['Срок',e?e.text:'не указан'],['Где',it.place],['После вскрытия',it.open_days!=null?it.open_days+' '+C.plural(it.open_days,'день','дня','дней'):'не указано']];
  if(it.category)rows.push(['Категория',it.category]);
  if(it.opened_on)rows.push(['Открыто',C.fmtDM(it.opened_on)]);
  rows.push(['Добавил(а)',C.pname(it.added_by)+', '+C.fmtDM(it.bought_on)]);
  var h='<div style="font-size:21px;font-weight:600;line-height:1.3">'+esc(it.name)+'</div><div class="fields">'+rows.map(function(r){return '<div class="fr"><span>'+r[0]+'</span><b style="font-weight:500;text-align:right">'+esc(r[1])+'</b></div>';}).join('')+'</div>';
  if(counted(it)){var st=stepFor(it.unit);h+='<div><div class="gl">Взять</div><div class="chips">'+st.map(function(x){return '<button class="chip" data-a="frUse" data-id="'+it.id+'" data-v="'+x+'">−'+num(x)+' '+esc(it.unit)+'</button>';}).join('')+'<button class="chip" data-a="frUseCustom" data-id="'+it.id+'">Сколько…</button><button class="chip" data-a="frSetQty" data-id="'+it.id+'">Осталось…</button></div></div>';}
  h+='<div><div class="gl">Состояние</div><div class="chips">'+(it.state!=='open'?'<button class="chip" data-a="frOpenIt" data-id="'+it.id+'">Открыл</button>':'')+STATES.filter(function(x){return x[0]!=='full'&&x[0]!=='open';}).map(function(x){return '<button class="chip'+(it.state===x[0]?' on':'')+'" data-a="frState" data-id="'+it.id+'" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>'+(it.state!=='open'&&it.open_days!=null?'<div class="gh">«Открыл» сократит срок до '+it.open_days+' '+C.plural(it.open_days,'дня','дней','дней')+'</div>':'')+'</div>';
  return h;
}
function itemFoot(it){return '<div class="row2"><button class="btn" data-a="frFinish" data-id="'+it.id+'">Закончилось</button><button class="btn2 warn" data-a="frToss" data-id="'+it.id+'">Выбросил</button></div><div class="row2"><button class="btn2" data-a="frEdit" data-id="'+it.id+'">'+I('edit')+'Изменить</button><button class="btn2 warn" data-a="frDel" data-id="'+it.id+'" aria-label="Удалить без записи в историю">'+I('trash')+'Удалить</button></div>';}
function expChips(s,key){
  var t=T(),cur=!s.expires?'none':s.expires===t?'0':s.expires===addDays(t,1)?'1':s.expires===addDays(t,3)?'3':s.expires===addDays(t,7)?'7':s.expires===addDays(t,14)?'14':s.expires===addDays(t,30)?'30':'pick';
  return chips('Срок годности',[['none','Без срока'],['0','Сегодня'],['1','Завтра'],['3','+3 дня'],['7','+неделя'],['14','+2 недели'],['30','+месяц']],cur,key,s._est?'Срок подставлен примерно по типу продукта — поправь, если на упаковке другой.':'','<label class="chip'+(cur==='pick'?' on':'')+'">'+(cur==='pick'?esc(C.fmtDM(s.expires)):'Дата…')+'<input type="date" data-frin="expires" value="'+(s.expires||t)+'" aria-label="Дата срока годности"></label>');
}
function editForm(s){
  var pl=places();if(s.place&&pl.indexOf(s.place)<0)pl=pl.concat([s.place]);
  var h='<input class="fld" id="fr-name" placeholder="Например, молоко" aria-label="Название продукта" value="'+esc(s.name||'')+'">';
  h+=chips('Где',pl.map(function(p){return[p,esc(p)];}),s.place,'place','','<button class="chip" data-a="frPlaceAdd">'+I('plus')+'Новое место</button>');
  h+='<div><div class="gl">Количество</div><div class="chips" style="align-items:center"><input class="fld" id="fr-qty" inputmode="decimal" autocomplete="off" style="width:110px;height:40px" placeholder="—" aria-label="Количество" value="'+esc(s.qty==null?'':num(+s.qty))+'">'+UNITS.map(function(u){return '<button class="chip'+(s.unit===u?' on':'')+'" data-a="frSet" data-k="unit" data-v="'+u+'">'+u+'</button>';}).join('')+'</div><div class="gh">Можно не указывать — тогда отмечай состояние: целая, половина и т. п.</div></div>';
  h+=chips('Состояние',STATES,s.state||'full','state');
  h+=expChips(s,'exp');
  var od=s.open_days;h+=chips('После вскрытия хранится',[['','Не указано'],[1,'1 день'],[2,'2 дня'],[3,'3 дня'],[5,'5 дней'],[7,'неделю'],[14,'2 недели'],[30,'месяц']],od==null?'':od,'open_days',s._kodays?'Подсказка: обычно '+s._kodays+' '+C.plural(s._kodays,'день','дня','дней'):'','<button class="chip'+(od!=null&&[1,2,3,5,7,14,30].indexOf(+od)<0?' on':'')+'" data-a="frCustom" data-k="open_days">'+(od!=null&&[1,2,3,5,7,14,30].indexOf(+od)<0?od+' дн.':'Своё…')+'</button>');
  h+=chips('Категория',[['','—']].concat(CATS.map(function(c){return[c,c];})),s.category||'','category');
  return h;
}
function buySheet(s){
  var h='<input class="fld" id="fr-name" aria-label="Название" value="'+esc(s.name||'')+'">';
  var pl=places();if(s.place&&pl.indexOf(s.place)<0)pl=pl.concat([s.place]);
  h+='<div><div class="gl">Количество</div><div class="chips" style="align-items:center"><input class="fld" id="fr-qty" inputmode="decimal" autocomplete="off" style="width:110px;height:40px" placeholder="—" aria-label="Количество" value="'+esc(s.qty==null?'':num(+s.qty))+'">'+UNITS.map(function(u){return '<button class="chip'+(s.unit===u?' on':'')+'" data-a="frSet" data-k="unit" data-v="'+u+'">'+u+'</button>';}).join('')+'</div></div>';
  h+=chips('Куда положить',pl.map(function(p){return[p,esc(p)];}),s.place,'place');
  h+=expChips(s,'exp');
  return h;
}
function settingsSheet(){
  var h='',me=C.ME,k=F.kitchen;
  if(F.kitchens.length>1)h+=chips('Какой холодильник открыть',F.kitchens.map(function(x){return[x.id,esc(x.name)+(x.owner!==me?' ('+esc(C.pname(x.owner))+')':'')];}),k&&k.id,'k_pick');
  if(k){
    var own=k.owner===me,mem=F.members.map(function(m){return m.user_id;});
    h+='<label><div class="gl">Название</div><input class="fld" id="fr-kname" value="'+esc(k.name)+'" aria-label="Название холодильника"'+(own?'':' disabled')+'></label>';
    if(own){h+='<div><div class="gl">Общий доступ</div>'+(C.others().length?'<div class="chips">'+C.others().map(function(p){var on=mem.indexOf(p.id)>=0;return '<button class="chip'+(on?' on':'')+'" data-a="frMember" data-v="'+p.id+'" aria-pressed="'+on+'">'+I('users')+esc(p.name||p.email)+'</button>';}).join('')+'</div><div class="gh">Отмеченные видят продукты и покупки, могут добавлять и списывать.</div>':'<div class="gh" style="margin:0">Пока не с кем делиться: второй человек должен хотя бы раз войти на сайт.</div>')+'</div>';}
    else h+='<div class="gh" style="margin:0">Холодильник создал(а) '+esc(C.pname(k.owner))+'. <button class="link" data-a="frLeave">Выйти из этого холодильника</button></div>';
    h+='<div><div class="gl">Места хранения</div><div class="chips">'+places().map(function(p,i){return '<button class="chip on" data-a="frPlaceDel" data-v="'+i+'" aria-label="Убрать место '+esc(p)+'">'+esc(p)+' '+I('x')+'</button>';}).join('')+'<button class="chip" data-a="frPlaceAdd">'+I('plus')+'Добавить</button></div></div>';
    var ap=appliances(),all=DEF_APPL.concat(MORE_APPL);ap.forEach(function(a){if(all.indexOf(a)<0)all.push(a);});
    h+='<div><div class="gl">Техника на кухне</div><div class="chips">'+all.map(function(a){var on=ap.indexOf(a)>=0;return '<button class="chip'+(on?' on':'')+'" data-a="frAppl" data-v="'+esc(a)+'" aria-pressed="'+on+'">'+esc(a)+'</button>';}).join('')+'<button class="chip" data-a="frApplAdd">'+I('plus')+'Своя</button></div><div class="gh">Помощник будет предлагать рецепты только под эту технику. Духовки нет — значит, без духовки.</div></div>';
  }
  var p=myPrefs();
  h+='<div class="rulebox"><div class="gl" style="margin:0;font-size:15px;color:var(--ink)">Мои ограничения в еде</div><label><div class="gl">Не люблю</div><textarea class="fld" id="fr-dislikes" rows="2" placeholder="Например: кинза, оливки, печень" aria-label="Не люблю">'+esc(p.dislikes||'')+'</textarea></label><label><div class="gl">Аллергия и нельзя</div><textarea class="fld" id="fr-allergies" rows="2" placeholder="Например: орехи, лактоза" aria-label="Аллергия">'+esc(p.allergies||'')+'</textarea></label><div class="gh" style="margin:0">У каждого свои. Рецепты будут учитывать ограничения всех, кто пользуется этим холодильником.</div></div>';
  var w=warnDays();h+=chips('Предупреждать о сроке за',[[0,'в последний день'],[1,'1 день'],[2,'2 дня'],[3,'3 дня'],[5,'5 дней']],w,'p_warn','',[0,1,2,3,5].indexOf(w)<0?'<button class="chip on" data-a="frCustom" data-k="p_warn">'+w+' дн.</button>':'<button class="chip" data-a="frCustom" data-k="p_warn">Своё…</button>');
  h+=chips('Уведомления о сроках',[['1','Включены'],['0','Выключены']],pset().notify===false?'0':'1','p_notify','Начнут приходить после следующего обновления. Нужны включённые уведомления на устройстве.');
  return h;
}
function sheet(s){
  if(s.type==='fr-item'){var it=F.items.filter(function(x){return x.id===s.id;})[0];if(!it)return null;return{title:'Продукт',body:itemSheet(it),foot:itemFoot(it)};}
  if(s.type==='fr-edit')return{title:s.id?'Изменить продукт':'Новый продукт',body:editForm(s),foot:'<button class="btn" data-a="frSave">'+(s.id?'Сохранить':'Добавить в холодильник')+'</button>'};
  if(s.type==='fr-buy')return{title:'Купил',body:buySheet(s),foot:'<button class="btn" data-a="frBuySave">'+I('fridge')+'Положить в холодильник</button><button class="btn2" data-a="frBuyOnly">Просто отметить купленным</button>'};
  if(s.type==='fr-settings')return{title:'Настройки холодильника',body:settingsSheet()};
  return null;
}
function bindSheet(root,first){
  var s=C.UI.sheet;
  var nm=root.querySelector('#fr-name');if(nm){nm.addEventListener('input',function(){s.name=nm.value;});if(first&&!s.id&&!nm.value)setTimeout(function(){nm.focus();},200);}
  var qy=root.querySelector('#fr-qty');if(qy)qy.addEventListener('input',function(){s.qty=qy.value.replace(',','.').replace(/[^0-9.]/g,'');});
  root.querySelectorAll('input[data-frin]').forEach(function(el){el.addEventListener('change',function(){if(!el.value)return;s.expires=el.value;s._est=false;C.renderSheet();});});
  var kn=root.querySelector('#fr-kname');if(kn)kn.addEventListener('change',function(){var v=kn.value.trim()||'Наш холодильник';F.kitchen.name=v;C.q(sb.from('kitchens').update({name:v}).eq('id',F.kitchen.id)).then(function(){toast('Название сохранено');},C.err);});
  ['dislikes','allergies'].forEach(function(f){var el=root.querySelector('#fr-'+f);if(el)el.addEventListener('change',function(){var o={};o[f]=el.value.trim().slice(0,500);savePrefs(o).then(function(){toast('Сохранено');});});});
}
async function savePrefs(patch){
  var p=Object.assign({},myPrefs(),patch);p.user_id=C.ME;F.prefs[C.ME]=p;
  try{var r=await C.q(sb.from('fridge_prefs').upsert({user_id:C.ME,dislikes:p.dislikes||'',allergies:p.allergies||'',settings:p.settings||{}},{onConflict:'user_id'}).select().single());F.prefs[C.ME]=r;}catch(e){C.err(e);}
}
async function saveKitchen(patch){var k=F.kitchen;k.settings=Object.assign({},k.settings||{},patch);C.renderSheet();try{await C.q(sb.from('kitchens').update({settings:k.settings}).eq('id',k.id));}catch(e){C.err(e);}rr();}
function itemById(id){return F.items.filter(function(x){return x.id===id;})[0];}

/* ---------- действия ---------- */
var A={
  frTab:function(v){F.tab=v;C.render();},
  frPlace:function(v){F.place=v;C.render();},
  frReload:function(){F.state='idle';F.err='';C.render();},
  frCreate:async function(){try{var k=await C.q(sb.from('kitchens').insert({name:'Наш холодильник',settings:{places:DEF_PLACES.slice(),appliances:DEF_APPL.slice()}}).select().single());try{localStorage.setItem(pickKey(),k.id);}catch(e){}F.state='ok';await load();toast('Холодильник создан. Партнёра можно добавить в настройках холодильника');}catch(e){C.err(e);}},
  frSettings:function(){C.UI.sheet={type:'fr-settings'};C.renderSheet(true);},
  frAdd:function(){if(!F.kitchen)return;var v=(document.getElementById('frin')||{}).value||'';var d={type:'fr-edit',name:'',place:F.place!=='all'?F.place:places()[0],qty:'',unit:'шт',state:'full',expires:null,open_days:null,category:''};
    if(v.trim()){var p=withDefaults(parseItems(v)[0]||{name:v});d.name=C.cap(p.name||'');if(p.qty!=null){d.qty=p.qty;d.unit=p.unit;}if(p.expires){d.expires=p.expires;d._est=p._est;}if(p.place)d.place=p.place;F.quick='';}
    C.UI.sheet=d;C.renderSheet(true);},
  frOpen:function(v,id){C.UI.sheet={type:'fr-item',id:id};C.renderSheet(true);},
  frMinus:function(v,id){var it=itemById(id);if(it)useAmount(it,stepFor(it.unit)[0]);},
  frUse:function(v,id){var it=itemById(id);if(it)useAmount(it,+v);},
  frUseCustom:function(v,id){var it=itemById(id);if(!it)return;var n=prompt('Сколько взяли ('+it.unit+')?','');if(n===null)return;n=parseFloat(String(n).replace(',','.'));if(!(n>0)){toast('Нужно число больше нуля');return;}useAmount(it,n);},
  frSetQty:async function(v,id){var it=itemById(id);if(!it)return;var n=prompt('Сколько осталось ('+it.unit+')?',num(+it.qty));if(n===null)return;n=parseFloat(String(n).replace(',','.'));if(!(n>=0)){toast('Нужно число');return;}if(n===0)return finish(it,'finish');var b=await patchItem(it,{qty:n},'edit','осталось '+num(n)+' '+it.unit);toast(it.name+': '+num(n)+' '+it.unit,function(){patchItem(it,{qty:b.qty});});},
  frOpenIt:function(v,id){var it=itemById(id);if(it)openItem(it);},
  frState:function(v,id){var it=itemById(id);if(it)setState(it,v);},
  frFinish:function(v,id){var it=itemById(id);if(it)finish(it,'finish');},
  frToss:function(v,id){var it=itemById(id);if(it)finish(it,'toss');},
  frDel:async function(v,id){var it=itemById(id);if(!it||!confirm('Удалить «'+it.name+'»? Это для ошибок: в историю и в покупки не попадёт.'))return;var i=F.items.indexOf(it);F.items.splice(i,1);C.closeSheet();rr();try{await C.q(sb.from('fridge_items').delete().eq('id',id));}catch(e){F.items.splice(i,0,it);rr();C.err(e);}},
  frEdit:function(v,id){var it=itemById(id);if(!it)return;var k=know(it.name)||{};C.UI.sheet={type:'fr-edit',id:id,name:it.name,place:it.place,qty:it.qty==null?'':it.qty,unit:it.unit,state:it.state,expires:it.expires,open_days:it.open_days,category:it.category,_kodays:k.open};C.renderSheet(true);},
  frSet:function(v,id,el){
    var k=el.getAttribute('data-k'),s=C.UI.sheet;
    if(k==='k_pick'){try{localStorage.setItem(pickKey(),v);}catch(e){}F.state='ok';load().then(function(){C.renderSheet();});return;}
    if(k==='p_warn'){var st=Object.assign({},pset(),{warn:+v});savePrefs({settings:st}).then(function(){C.renderSheet();rr();});return;}
    if(k==='p_notify'){var st2=Object.assign({},pset(),{notify:v==='1'});savePrefs({settings:st2}).then(function(){C.renderSheet();});return;}
    if(!s)return;
    if(k==='exp'){s.expires=v==='none'?null:addDays(T(),+v);s._est=false;}
    else if(k==='open_days'){s.open_days=v===''?null:+v;}
    else s[k]=v;
    if(k==='name'){var kk=know(v);s._kodays=kk&&kk.open;}
    C.renderSheet();
  },
  frCustom:function(v,id,el){
    var k=el.getAttribute('data-k'),s=C.UI.sheet;var n=prompt('Сколько дней?','');if(n===null)return;n=parseInt(String(n).replace(/[^0-9]/g,''),10);
    if(!(n>=0&&n<=365)){toast('Нужно число от 0 до 365');return;}
    if(k==='p_warn'){savePrefs({settings:Object.assign({},pset(),{warn:n})}).then(function(){C.renderSheet();rr();});return;}
    s.open_days=n;C.renderSheet();
  },
  frSave:async function(){
    var s=C.UI.sheet;var name=(s.name||'').trim();if(!name){toast('Напиши название продукта');return;}
    var qty=s.qty===''||s.qty==null?null:parseFloat(String(s.qty).replace(',','.'));if(qty!=null&&!(qty>=0)){toast('Количество — это число');return;}
    var f={name:C.cap(name).slice(0,120),place:s.place||places()[0],qty:qty,unit:s.unit||'шт',state:s.state||'full',expires:s.expires||null,open_days:s.open_days==null||s.open_days===''?null:+s.open_days,category:s.category||''};
    C.closeSheet();
    if(s.id){var it=itemById(s.id);if(it){await patchItem(it,f,'edit','');toast('Сохранено');}}
    else{var r=await addItem(f);if(r)toast('Добавлено: '+r.name);}
  },
  frMember:async function(v){
    var mem=F.members.map(function(m){return m.user_id;}),k=F.kitchen;
    try{if(mem.indexOf(v)>=0){await C.q(sb.from('kitchen_members').delete().eq('kitchen_id',k.id).eq('user_id',v));F.members=F.members.filter(function(m){return m.user_id!==v;});toast('Доступ убран: '+C.pname(v));}
      else{var r=await C.q(sb.from('kitchen_members').insert({kitchen_id:k.id,user_id:v}).select().single());F.members.push(r);toast('Теперь '+C.pname(v)+' видит холодильник');}}catch(e){C.err(e);}
    C.renderSheet();
  },
  frLeave:async function(){if(!confirm('Выйти из холодильника «'+F.kitchen.name+'»? Продукты останутся у владельца.'))return;try{await C.q(sb.from('kitchen_members').delete().eq('kitchen_id',F.kitchen.id).eq('user_id',C.ME));try{localStorage.removeItem(pickKey());}catch(e){}C.closeSheet();F.state='ok';load();}catch(e){C.err(e);}},
  frPlaceAdd:function(){var n=prompt('Новое место хранения, например «Балкон» или «Ящик для овощей»');if(!n||!n.trim())return;n=C.cap(n.trim()).slice(0,40);var pl=places();if(pl.indexOf(n)<0)pl.push(n);var s=C.UI.sheet;if(s&&(s.type==='fr-edit'||s.type==='fr-buy'))s.place=n;saveKitchen({places:pl});},
  frPlaceDel:function(v){var pl=places();if(pl.length<=1){toast('Нужно хотя бы одно место');return;}var p=pl.splice(+v,1)[0];saveKitchen({places:pl});toast('Место «'+p+'» убрано. Продукты в нём остались');},
  frAppl:function(v){var a=appliances().slice(),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);saveKitchen({appliances:a});},
  frApplAdd:function(){var n=prompt('Какая техника? Например, «Мультипечь»');if(!n||!n.trim())return;n=C.cap(n.trim()).slice(0,40);var a=appliances().slice();if(a.indexOf(n)<0)a.push(n);saveKitchen({appliances:a});},
  frBuy:function(v,id){var s=F.shop.filter(function(x){return x.id===id;})[0];if(!s)return;var k=know(s.name)||{};var shelf=s.shelf_days||k.shelf;
    C.UI.sheet={type:'fr-buy',id:id,name:s.name,qty:s.qty==null?'':s.qty,unit:s.unit,place:s.place||places()[0],expires:shelf&&s.place!=='Морозилка'&&s.place!=='Шкаф'?addDays(T(),shelf):null,_est:!!shelf,open_days:s.open_days,category:s.category};C.renderSheet(true);},
  frBuySave:async function(){var s=C.UI.sheet,sh=F.shop.filter(function(x){return x.id===s.id;})[0];var qty=s.qty===''||s.qty==null?null:parseFloat(String(s.qty).replace(',','.'));
    C.closeSheet();var r=await addItem({name:s.name||sh.name,qty:qty,unit:s.unit,place:s.place,expires:s.expires,open_days:s.open_days,category:s.category},true);
    if(r){logIt(r.name,'buy','');if(sh)await patchShop(sh,{done:true,done_at:new Date().toISOString()});toast('В холодильнике: '+r.name);}},
  frBuyOnly:async function(){var s=C.UI.sheet,sh=F.shop.filter(function(x){return x.id===s.id;})[0];C.closeSheet();if(sh){await patchShop(sh,{done:true,done_at:new Date().toISOString()});logIt(sh.name,'buy','');toast('Куплено: '+sh.name);}},
  frUnbuy:function(v,id){var s=F.shop.filter(function(x){return x.id===id;})[0];if(s)patchShop(s,{done:false,done_at:null});},
  frShopDel:async function(v,id){var s=F.shop.filter(function(x){return x.id===id;})[0];if(!s)return;var i=F.shop.indexOf(s);F.shop.splice(i,1);rr();
    try{await C.q(sb.from('fridge_shop').delete().eq('id',id));toast('Убрано из покупок: '+s.name,async function(){var c=Object.assign({},s);delete c.created_at;try{var b=await C.q(sb.from('fridge_shop').insert(c).select().single());F.shop.push(b);rr();}catch(e){C.err(e);}});}catch(e){F.shop.splice(i,0,s);rr();C.err(e);}},
  frShopClear:async function(){var done=F.shop.filter(function(x){return x.done;});if(!done.length)return;F.shop=F.shop.filter(function(x){return !x.done;});rr();
    try{await C.q(sb.from('fridge_shop').delete().eq('kitchen_id',F.kitchen.id).eq('done',true));}catch(e){C.err(e);F.state='ok';load();}}
};
Object.keys(A).forEach(function(k){C.A[k]=A[k];});

window.FRIDGE={view:view,sheet:sheet,bindSheet:bindSheet,bindMain:bindMain,voice:voice,hasKitchen:function(){return !!F.kitchen;},
  _F:F,_parse:parseItems,_find:findItem,_load:load};
if(C.ME&&C.UI.view==='fridge')C.render();
}
if(window.__core)boot();else window.FRIDGE_BOOT=boot;
})();
