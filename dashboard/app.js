(()=>{
const M=window.RADAR_META;
const D=window.RADAR.map(x=>({s:x[0],n:x[1],r:x[2],v:x[3],t:x[4],c:x[5],ch:x[6],f:x[7],g:x[8],m:x[9],z:x[10],o:x[11],p:x[12],a:x[13],d:x[14],seg:x[15]}));
const usd=n=>"$"+n.toFixed(2);
function st(t,c,ti){let j=t+" Cost: "+c+". Time: "+ti+".";j=j.length>600?j.slice(0,596)+"...":j;return j.length<20?j+" Hold the position and check the protocol's own page.":j}
// Farm templates, lib/farm-plan.ts. Row: [pre,sMid,sTail,sMin,cMid,cMin,core,cc,ct,wk,wc,wm,hold,young,hc,hv,exit,et,eg,ev,etm]. %n name %c chain %t token %g gas %k cap %h hold %2 gasx2 %3 gasx3 %5 sub.
const PRE=["Use a fresh wallet that holds only the funds you plan to farm on %n","Use a fresh wallet that holds only the funds you plan to farm in USDC"];
const STAIL=[", plus enough %t for fees on %c.",", plus enough %t for fees on %c, and read the liquidation rules before any deposit.",", plus enough %t for fees on %c, and check whether the protocol needs any eligibility step before minting.",", plus enough %t for gas on %c, since every action on a chain costs its native token.",", plus enough %t for fees on %c, and check the eligibility rules for the next sale or lock.",", plus enough %t for fees on %c, and set it as the wallet you pay from.",""];
const CORECOST=["$%k of capital and about %g of gas","$%k of capital and about %2 of gas for the two transactions","$%k of capital and about %3 of gas for the bridge and the first use","$%k of capital and about %2 of gas for the deposit and the hedge","$%k of capital and about %2 of gas for the bridge and the first use","$%k of cover plus the premium, and about %g of gas","$%k of payments and about %g of gas per payment"];
const CORETIME=["15 minutes to set up","20 minutes to set up","20 minutes to set up, plus finality","15 minutes to set up, then a week of payments"];
const WCOST=["about %g of gas a week","about %2 of gas a week","nothing a week"];
const WTIME=["10 minutes a week","15 minutes a week","5 minutes a week"];
const YOUNG=["","; a protocol this young needs the longer window to prove the position is real","; a protocol this young needs the longer window to prove the route use is real","; a protocol this young needs the longer window to prove the holding is real","; a chain this young needs the longer window to prove the activity is real"];
const ETAIL=["Claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.","Claim any points only from the link the protocol itself publishes, and never pay to claim.","Claim any points or rewards only from the link the chain itself publishes, and never pay to claim.",""];
const F={
lending:[0,"",0,5,"read its liquidation threshold, loan-to-value limit and oracle setup before you deposit anything.",20,"Supply $%k of USDC as collateral to %n on %c, then borrow about 30% of it in stablecoins so the position records both a supply and a borrow.",1,0,"top up the collateral or repay part of the borrow so the health factor on %n stays above 2, and leave the position open between actions.",0,0,"Hold the %n position for at least %h days so interest accrues and the activity is counted in more than one snapshot",1,"the $%k stays in the position",0,"Repay the %n borrow in full first, then withdraw the collateral. ",0,1,"to unwind","15 minutes"],
dex:[0,", split into the two assets of the pool",0,5,"check the main pool's fee tier, the price range it covers, the audit report and whether its TVL is holding.",20,"Provide $%k of liquidity to %n's main pool on %c inside the active price range, so the position earns trading fees from the first day.",0,0,"collect the earned fees from %n and, if the price moved out of range, move the position back into range instead of leaving it idle.",1,1,"Hold the %n position for at least %h days so fee income accrues and the liquidity counts across more than one snapshot",1,"the $%k stays in the pool; impermanent loss moves with the price",0,"Remove the liquidity from %n in one transaction and claim the fees from the pool page itself. ",0,0,"to exit","10 minutes"],
staking:[0,", in the chain's staking asset",0,5,"read the validator set, the slashing terms and the unbonding period before you stake anything.",20,"Stake $%k of the staking asset through %n on %c and keep the liquid receipt token it issues; do not sell the receipt, it is the proof of the stake.",0,0,"restake the %n staking rewards and keep the receipt token in the wallet, so the stake compounds instead of sitting still.",0,0,"Hold the %n stake for at least %h days; rewards accrue per epoch and the position counts across more than one snapshot",1,"the $%k stays staked",0,"Start the %n unbonding early, because it takes days to weeks before the funds return, then claim any points or rewards only from the link the protocol itself publishes, and never pay to claim.",3,0,"to start the exit","10 minutes, plus the unbonding wait"],
yield:[0,"",0,5,"read the vault strategy, the underlying protocols it deposits into, the curator's track record and the fee schedule.",25,"Deposit $%k of USDC into the %n vault on %c and keep the vault shares it issues; the shares are the position, and their value is where the yield lands.",0,0,"check whether the %n vault changed strategy or curator, and add a small top-up only while the strategy is unchanged.",0,0,"Hold the %n shares for at least %h days so the yield compounds inside them and the deposit counts across more than one snapshot",1,"the $%k stays in the vault",0,"Redeem the %n vault shares through the protocol's own page; some vaults queue redemptions, so start the exit before you need the funds. ",1,0,"to redeem","10 minutes, plus any redemption queue"],
bridge:[0,", with gas on both sides of the route: %t on %c and gas on the destination chain.",6,10,"check the bridge's security model, its fee per transfer, the supported routes and how long finality takes.",20,"Bridge $%k of USDC through %n to its main destination chain, then use the bridged funds once in an app on that chain so the transfer is not a dead end.",2,2,"bridge a small amount across %n again or use the bridged funds in a destination-chain app, so the route sees repeated use rather than one transfer.",1,1,"Keep bridging activity on %n going for at least %h days so the route use is counted across more than one snapshot",2,"the $%k stays working on the destination chain",0,"Bridge the funds back to the origin chain through %n. ",0,1,"to bridge back","15 minutes, plus finality"],
derivatives:[0,"",1,10,"check the funding rate, the margin requirement, the oracle it prices from and the liquidation price for the position you plan.",25,"Deposit $%k of USDC as margin on %n and open one small hedge worth no more than 20% of that margin, so a move against you cannot liquidate the whole deposit.",3,1,"check %n's funding rate and the margin level, close the hedge and reopen it if the rate turned against you, and keep the margin above the maintenance level.",1,1,"Keep the %n margin position open for at least %h days so the trading activity counts across more than one snapshot",1,"the $%k stays as margin; a liquidation would lose part of it",0,"Close the %n hedge first, then withdraw the margin in one transaction. ",0,1,"to close out","15 minutes"],
rwa:[0,"",2,10,"read what backs the asset, who the custodian is, the redemption terms and the audit of the reserves.",25,"Mint $%k of the protocol's yield-bearing asset on %c through %n and hold the minted tokens in the wallet.",0,0,"check the yield that accrued on the minted %n asset and reinvest the distribution if the protocol lets you compound it.",0,0,"Hold the minted %n asset for at least %h days so the yield accrues and the holding counts across more than one snapshot",3,"the $%k stays in the minted asset",0,"Redeem the %n asset through the protocol's own page; redemption can take days while the custodian settles, so start before you need the funds. ",1,0,"to redeem","10 minutes, plus settlement"],
chain:[0,"",3,5,"check the official bridge contract, the apps live on it and whether its TVL is holding.",20,"Bridge $%k of USDC to %c and use it once in a native app on the chain, such as a swap or a stake, so the funds do real work there.",4,2,"make one transaction in a native app on %c, such as a swap, a stake or a vote, so the wallet stays active on %n.",0,0,"Stay active on %n for at least %h days so the activity counts across more than one snapshot",4,"the $%k stays working on the chain",0,"Bridge the funds back out through %n's official bridge. ",2,1,"to bridge out","15 minutes, plus finality"],
prediction:[1,"",0,5,"read the market rules, the resolution source and the trading fee before you place anything.",15,"Fund the wallet with $%k and place one position of no more than $%5 on an open market on %n that resolves after your hold window, keeping the rest in reserve.",0,0,"place one more small position on a new %n market, so the wallet shows repeated trading rather than a single bet.",0,0,"Keep trading on %n for at least %h days and let the markets resolve on their own schedule; do not chase a loss by doubling a position",0,"the $%k stays in open positions until they resolve",0,"Claim winnings from each resolved %n market on the market page itself. ",0,0,"per claim","10 minutes"],
launchpad:[0,"",4,10,"read the lock period, the allocation rules and the vesting schedule before you commit anything.",20,"Commit $%k through %n on %c to its current sale pool or lock, following the allocation rules it publishes.",0,0,"check the %n sale or lock status and join the next round only while the terms are unchanged.",0,0,"Keep the %n commitment locked for at least %h days, or the full vesting period if it is longer, so the lock counts across more than one snapshot",0,"the $%k stays locked",1,"Claim the %n allocation only after the vesting date, from the protocol's own page. ",1,0,"to claim","10 minutes"],
insurance:[0,"",0,5,"read what the cover actually pays for, the exclusions, the claim process and the premium rate.",20,"Buy $%k of cover from %n on %c for the protocol you already use, and keep the policy active.",5,0,"check the %n policy is still active and the covered protocol has not changed its contracts in a way the cover excludes.",2,2,"Keep the %n cover active for at least %h days so the policy counts across more than one snapshot",0,"the premium is spent; the $%k is the covered amount",0,"Let the %n policy run to its end date, or cancel it from the protocol's own page if it allows early exit. ",1,0,"to cancel, if allowed","10 minutes"],
payments:[0,"",5,10,"read the supported payment rails, the fees per payment and the limits before you route anything through it.",15,"Route $%k of real payments through %n on %c over the first week, for things you would pay for anyway.",6,3,"!Keep paying through %n every week, at least once, so the wallet shows steady payment volume rather than one burst.",0,0,"Keep the payment activity on %n going for at least %h days so the volume counts across more than one snapshot",0,"the $%k is spent on real payments",0,"Stop routing new payments and withdraw any balance from %n's page. ",1,0,"to withdraw","10 minutes"],
otc:[0,"",0,5,"read the order types, the settlement terms and the counterparty rules before you place anything.",15,"Place one $%k order through %n on %c at the published price, and let it settle on the protocol's own terms.",0,0,"check your open %n orders and place one more small order only while the published prices still make sense.",0,0,"Keep trading on %n for at least %h days so the activity counts across more than one snapshot",0,"the $%k stays in settled trades",0,"Cancel any open order and withdraw the balance from %n's page. own page. ",1,0,"to withdraw","10 minutes"],
fallback:[0,"",0,5,"read what its main product does, the risks it names and the audit report before you deposit anything.",20,"Deposit $%k of USDC into %n's main product on %c and keep the position open.",0,0,"use %n's main product again, such as a deposit, a swap or a vote, so the wallet shows repeated use.",0,0,"Hold the %n position for at least %h days so the activity is counted in more than one snapshot",1,"the $%k stays in the position",0,"Withdraw the position from %n's page. ",0,0,"to exit","10 minutes"]
};
function expandFarm(x){
 const f=x.f,fa=F[f[0]],net=x.ch[0]||"its main chain",cap=f[1],hold=f[2],gas=f[3];
 const ctx={n:x.n,c:net,t:f[4],g:usd(gas),k:String(cap),h:String(hold),"2":usd(gas*2),"3":usd(gas*3),"5":String(Math.max(10,Math.floor(cap/5)))};
 const S=s=>s.replace(/%([nctghk235])/g,(m,k)=>ctx[k]);
 const split=x.t>=1e9?" Split the position across two wallets, so one mistake cannot take the whole position.":"";
 const multi=f[6]>=1?" The protocol also runs on "+f[6]+" other chain"+(f[6]===1?"":"s")+"; farm on "+net+" only, so the activity stays in one place.":"";
 const falling=f[5]===1?" Its TVL fell 20% or more in the last 7 days, so start with the halved size and check why deposits are leaving before adding more.":"";
 const young=x.a!==null&&x.a<180?YOUNG[fa[13]]:"";
 const wk=fa[9].charAt(0)==="!"?fa[9].slice(1):"Once a week, "+fa[9];
 return [
  st(S(PRE[fa[0]]+fa[1]+STAIL[fa[2]]+split+multi),S("about %g of gas for the first transaction"),fa[3]+" minutes"),
  st(S("Open %n's docs and "+fa[4]+falling),"nothing to check",fa[5]+" minutes"),
  st(S(fa[6]),S(CORECOST[fa[7]]),CORETIME[fa[8]]),
  st(S(wk),S(WCOST[fa[10]]),WTIME[fa[11]]),
  st(S(fa[12]+young+"."),S(fa[14]),hold+(fa[15]?" days, or the vesting period":" days")),
  st(S(fa[16]+ETAIL[fa[17]]),S("about %"+(fa[18]?"2":"g")+" of gas "+fa[19]),fa[20])
 ];
}
window.__expandFarm=expandFarm;

function money(n){return '$'+(n>=1e9?(n/1e9).toFixed(1)+'B':n>=1e6?(n/1e6).toFixed(1)+'M':Math.round(n/1e3)+'K')}
function moneyFull(n){return '$'+n.toLocaleString('en-US')}
function fmt(n){return n.toFixed(4)}
function pct(d){return d===null?'n/a':(d>0?'+':'')+d.toFixed(1)+'%'}
const Q=s=>document.querySelector(s);
const board=Q('#board');
const live=Q('#live');
const q=Q('#q');
const cat=Q('#cat');
const seg=Q('#seg');
const detail=Q('#detail');
Q('#count').textContent=D.length;
Q('#total').textContent='total '+money(M.stats[0]);
Q('#claims').innerHTML=M.claims.map(c=>`<span class="claim">${c}</span>`).join('')+'<span class="claim dim">758 protocols audited</span>';
Q('#calib').innerHTML=`n=<b>${M.cal[0]}</b> live-token protocols (CEX excluded): median mcap/TVL <b>${M.cal[1]}</b>, p25 ${M.cal[2]}, p75 ${M.cal[3]}.`;
Q('#odds').innerHTML=`P<sub>listed</sub> is a logit fitted on all 758 snapshot protocols. Held-out AUC <b>0.78</b> over 4 splits; 7-day change is NOT in the logit.`;
const L=M.model.logit;
const cats=Object.keys(L).filter(k=>["intercept","log_tvl","age_years","age_known","log_chains"].indexOf(k)<0).map(k=>`${k} ${L[k]>=0?'+':''}${L[k]}`).join(' · ');
Q('#logit').innerHTML=`z = ${L.intercept} + ${L.log_tvl}×(log10TVL − 8) + ${L.age_years}×age_years ${L.age_known}×age_known + ${L.log_chains}×log1p(chains) + category term; P = 1 / (1 + e^-z).<br>Category terms: ${cats}.`;
Q('#top10').innerHTML='<span class="t10h">TOP 10</span>'+D.slice(0,10).map(x=>`<button class="t10" data-s="${x.s}">${x.r}. ${x.n} <b>${money(x.v)}</b></button>`).join('');
[...new Set(D.map(x=>x.c||'Other'))].sort().forEach(x=>cat.add(new Option(x,x)));
let desc=true;
function mult(x){return `TVL ${money(x.t)} · 7d ${pct(x.d)} · age ${x.a===null?'unknown':x.a+'d'} · growth ×${fmt(x.g)} · maturity ×${fmt(x.m)} · size ×${fmt(x.z)} · odds ×${fmt(x.o)} · P ${fmt(x.p)}`}
function renderLive(){
 live.innerHTML='<h2>Live tokens — set aside, never ranked</h2><p>'+M.live_n+' protocols with a token, CEX excluded, biggest market cap first.</p>'+M.live.map((L,i)=>`<article class="row"><div class="rank">${String(i+1).padStart(2,'0')}</div><div><div class="name">${L[1]}</div><div class="meta">${L[0]}</div></div><div><span class="tag">${L[2]||'Other'}</span><div class="meta">${L[3].join(' · ')}</div></div><div class="value">${money(L[5])}<div class="meta">TVL ${money(L[4])} · 7d ${pct(L[6])}</div></div><div class="arrow"></div></article>`).join('');
}
function render(){
 let h=new URLSearchParams(location.hash.slice(1));
 let f=h.get('filter')||'';
 if(f&&!cat.value)cat.value=f;
 let v=h.get('view')||'board';
 Q('#vBoard').className=v==='board'?'on':'';
 Q('#vLive').className=v==='live'?'on':'';
 if(v==='live'){board.style.display='none';live.style.display='block';renderLive();}
 else{board.style.display='block';live.style.display='none';}
 let a=D.filter(x=>(x.n+' '+x.s+' '+(x.c||'')+' '+x.ch.join(' ')).toLowerCase().includes(q.value.toLowerCase())&&(!cat.value||x.c===cat.value)&&(!seg.value||x.seg===+seg.value));
 a.sort((x,y)=>(desc?1:-1)*(y.v-x.v));
 board.innerHTML=a.map(x=>`<article class="row" data-s="${x.s}"><div class="rank">${String(x.r).padStart(3,'0')}</div><div><div class="name">${x.n}</div><div class="meta">${x.s} · ${x.seg===0?'Watchlist':'Early'}</div></div><div><span class="tag">${x.c||'Other'}</span><div class="meta">${x.ch.join(' · ')}</div></div><div class="value">${money(x.v)}<div class="meta">TVL ${money(x.t)}</div></div><div class="arrow">→</div><div class="mult">${mult(x)}</div></article>`).join('')||'<p>No signals match.</p>';
 document.querySelectorAll('.row').forEach(e=>e.onclick=()=>location.hash='p='+e.dataset.s);
}
function show(){
 let s=new URLSearchParams(location.hash.slice(1)).get('p');
 let x=D.find(y=>y.s===s);
 if(!x){detail.className='';return}
 detail.className='show';
 const steps=expandFarm(x);
 const med=M.stats[1];
 detail.innerHTML=`<p class="eyebrow">RANK ${x.r} · ${x.c||'Other'} · ${x.seg===0?'WATCHLIST':'EARLY'}</p><h2>${x.n}</h2><p>${x.s} · implied value <b>${money(x.v)}</b> · TVL ${money(x.t)} · 7d ${pct(x.d)} · age ${x.a===null?'unknown':x.a+' days'} · chains ${x.ch.join(' · ')}${x.f[6]>=1?' (+'+x.f[6]+' more)':''}</p><div class="formula">TVL ${moneyFull(x.t)} × 0.1811 × growth ${fmt(x.g)} × maturity ${fmt(x.m)} × size ${fmt(x.z)} × odds ${fmt(x.o)} = <b>${moneyFull(x.v)}</b> · P(listed) ${fmt(x.p)} · vs board median ${money(med)} (×${(x.v/med).toFixed(1)})</div><div class="steps">${steps.map((z,i)=>`<div class="step"><b>0${i+1}</b> ${z}</div>`).join('')}</div>`;
 detail.scrollIntoView({behavior:'auto',block:'start'});
}
q.oninput=render;
cat.onchange=render;
seg.onchange=render;
Q('#sort').onclick=()=>{desc=!desc;Q('#sort').textContent=desc?'Sort: value ↓':'Sort: value ↑';render()};
Q('#vBoard').onclick=()=>{location.hash='view=board'};
Q('#vLive').onclick=()=>{location.hash='view=live'};
Q('#top10').onclick=e=>{const b=e.target.closest('[data-s]');if(b)location.hash='p='+b.dataset.s};
addEventListener('hashchange',()=>{render();show()});
render();
show();
})()
