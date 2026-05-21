(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const u of o.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&n(u)}).observe(document,{childList:!0,subtree:!0});function r(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function n(i){if(i.ep)return;i.ep=!0;const o=r(i);fetch(i.href,o)}})();const K=100,ct="1999-01-01",lt="http://www.w3.org/2000/svg",X=document.querySelector("#app");if(!X)throw new Error("Missing #app container");X.innerHTML=`
  <main class="page-shell">
    <section class="chart-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">NASDAQ 100</p>
          <h1>日定投收益静态可视化</h1>
        </div>
        <div class="dataset-meta" id="dataset-meta">加载中...</div>
      </div>
      <div class="chart-stage">
        <div class="status-overlay" id="chart-status">正在加载数据...</div>
        <svg id="chart" class="chart" aria-label="纳斯达克100价格走势图"></svg>
      </div>
    </section>
    <section class="control-panel">
      <div class="card form-card">
        <h2>定投参数</h2>
        <form id="controls" class="control-form">
          <label>
            <span>开始日期</span>
            <input id="start-date" name="start-date" type="date" required />
          </label>
          <label>
            <span>每日定投金额</span>
            <input id="daily-amount" name="daily-amount" type="number" min="0" step="1" required />
          </label>
          <button type="button" id="reset-button" class="secondary-button">重置</button>
        </form>
        <p class="form-hint" id="form-hint">从开始日期对应的首个可用交易日起，每个交易日买入一次。</p>
      </div>
      <div class="card summary-card">
        <h2>最新汇总</h2>
        <div class="metric-grid" id="summary-grid"></div>
      </div>
      <div class="card hover-card">
        <h2>当前指向</h2>
        <div class="metric-grid" id="hover-grid"></div>
      </div>
    </section>
  </main>
`;const s=document.querySelector("#chart"),N=document.querySelector(".chart-stage"),C=document.querySelector("#chart-status"),Y=document.querySelector("#dataset-meta"),J=document.querySelector("#controls"),L=document.querySelector("#start-date"),I=document.querySelector("#daily-amount"),tt=document.querySelector("#reset-button"),A=document.querySelector("#form-hint"),H=document.querySelector("#summary-grid"),E=document.querySelector("#hover-grid");if(!s||!N||!C||!Y||!J||!L||!I||!tt||!A||!H||!E)throw new Error("Failed to initialize UI");let d=[],c=null,g=null,T=null,Q=null;dt();async function dt(){try{if(d=await ut(),d.length===0)throw new Error("CSV 中没有可用数据");const t=d[0].date;L.min=ct,L.max=d[d.length-1].date,L.value=t,I.value=String(K),Y.textContent=`${d[0].date} 至 ${d[d.length-1].date} · ${d.length} 个交易日`,J.addEventListener("input",pt),tt.addEventListener("click",mt),s.addEventListener("pointermove",gt),s.addEventListener("pointerleave",xt),Q=new ResizeObserver(()=>{c&&q(c)}),Q.observe(N),O()}catch(t){const e=t instanceof Error?t.message:"数据加载失败";C.textContent=e,C.classList.remove("is-hidden"),A.textContent=e}}async function ut(){const t=new URL("NASDAQ100.csv",document.baseURI).toString(),e=await fetch(t);if(!e.ok)throw new Error(`读取 CSV 失败: ${e.status}`);const n=(await e.text()).trim().split(/\r?\n/).slice(1).map(o=>o.split(",")).map(([o,u])=>({date:o?.trim()??"",indexValue:Number(u)})).filter(o=>o.date&&Number.isFinite(o.indexValue));let i=null;return n.map(o=>o.indexValue===0&&i!==null?{...o,indexValue:i}:(i=o.indexValue,o))}function pt(){O()}function mt(){L.value=d[0]?.date??"",I.value=String(K),O()}function O(){if(d.length===0)return;const t=L.value,e=ft(I.value);I.value=e.toString(),c=ht(d,t,e),g=c.points.length>0?c.points.length-1:null,q(c),U(c)}function ft(t){const e=Number(t);return!Number.isFinite(e)||e<0?0:Math.round(e*100)/100}function ht(t,e,r){const n=t.findIndex(p=>p.date>=e);if(n===-1)return{points:[],startDate:e,dailyAmount:r,warning:`开始日期 ${e} 晚于数据末尾，无法计算收益。`};let i=0,o=0;const x=t.slice(n).map(p=>{r>0&&(i+=r,o+=r/p.indexValue);const h=o*p.indexValue,M=h-i,P=i>0?M/i:0;return{date:p.date,indexValue:p.indexValue,investedAmount:i,unitsHeld:o,portfolioValue:h,profit:M,profitRate:P,isContributionDay:!0}}),f=t[n]?.date??e;let v=null;return e<t[0].date?v=`输入日期早于数据起点，已从首个可用交易日 ${f} 开始定投。`:f!==e&&(v=`输入日期不是交易日，已从下一个交易日 ${f} 开始定投。`),{points:x,startDate:f,dailyAmount:r,warning:v}}function q(t){for(;s.firstChild;)s.removeChild(s.firstChild);if(t.points.length===0){C.textContent=t.warning??"暂无可展示数据",C.classList.remove("is-hidden");return}C.classList.add("is-hidden");const e=Math.max(N.clientWidth,320),r=Math.max(N.clientHeight,240);s.setAttribute("viewBox",`0 0 ${e} ${r}`);const n={top:Math.max(22,r*.05),right:Math.max(18,e*.025),bottom:Math.max(40,r*.09),left:Math.max(62,e*.075)},i=e-n.left-n.right,o=r-n.top-n.bottom,u=Math.min(...t.points.map(a=>a.indexValue)),x=Math.max(...t.points.map(a=>a.indexValue)),f=u*.97,v=x*1.03,p=t.points.length-1,b=t.points[0].date,h=t.points[p].date,M=V(b),P=V(h),nt=Math.max(P-M,1),$=a=>n.left+(V(a)-M)/nt*i,z=a=>n.top+(v-a)/(v-f||1)*o,y=t.points.map(a=>$(a.date));T={width:e,height:r,plotLeft:n.left,plotRight:e-n.right,xPositions:y};const B=l("defs"),G=l("linearGradient",{id:"price-gradient",x1:"0%",y1:"0%",x2:"0%",y2:"100%"});G.append(l("stop",{offset:"0%","stop-color":"#f25f5c","stop-opacity":"0.32"}),l("stop",{offset:"100%","stop-color":"#f25f5c","stop-opacity":"0.02"})),B.appendChild(G),s.appendChild(B);const _=t.points.map((a,S)=>`${S===0?"M":"L"} ${y[S].toFixed(2)} ${z(a.indexValue).toFixed(2)}`).join(" "),rt=l("path",{d:`${_} L ${y[p].toFixed(2)} ${(r-n.bottom).toFixed(2)} L ${y[0].toFixed(2)} ${(r-n.bottom).toFixed(2)} Z`,fill:"url(#price-gradient)"});s.appendChild(rt);for(let a=0;a<=4;a+=1){const S=f+(v-f)*a/4,R=n.top+o-o*a/4;s.appendChild(l("line",{x1:String(n.left),y1:String(R),x2:String(e-n.right),y2:String(R),class:"grid-line"}));const j=l("text",{x:String(n.left-14),y:String(R+5),class:"axis-label","text-anchor":"end"});j.textContent=et(S),s.appendChild(j)}const it=l("path",{d:_,class:"price-line"});s.appendChild(it);const ot=l("line",{x1:String(n.left),y1:String(r-n.bottom),x2:String(e-n.right),y2:String(r-n.bottom),class:"axis-line"});s.appendChild(ot);const at=[{label:b,x:$(b),anchor:"start"},{label:k(b,h),x:$(k(b,h)),anchor:"middle"},{label:h,x:$(h),anchor:"end"}];for(const a of at){const S=l("text",{x:String(a.x),y:String(r-12),class:"axis-label","text-anchor":a.anchor});S.textContent=a.label,s.appendChild(S)}const F=g??p,st=t.points[F];s.appendChild(l("line",{x1:String(y[F]),y1:String(n.top),x2:String(y[F]),y2:String(r-n.bottom),class:"hover-line"})),s.appendChild(l("circle",{cx:String(y[F]),cy:String(z(st.indexValue)),r:"6",class:"hover-point"}))}function U(t){const e=t.points.at(-1),r=g!==null?t.points[g]:e,n=t.warning??`起投生效日：${t.startDate}`;if(A.textContent=n,A.classList.toggle("warning-text",!!t.warning),!e){H.innerHTML='<p class="empty-state">无可计算数据</p>',E.innerHTML='<p class="empty-state">请选择更早的开始日期</p>';return}if(H.innerHTML=W([m("累计投入",w(e.investedAmount),"neutral"),m("持仓市值",w(e.portfolioValue),"neutral"),m("总收益",w(e.profit),D(e.profit)),m("收益率",Z(e.profitRate),D(e.profitRate))]),!r){E.innerHTML='<p class="empty-state">暂无 hover 数据</p>';return}E.innerHTML=W([m("当前日期",r.date,"neutral"),m("纳指点位",et(r.indexValue),"neutral"),m("累计投入",w(r.investedAmount),"neutral"),m("持仓市值",w(r.portfolioValue),"neutral"),m("总收益",w(r.profit),D(r.profit)),m("收益率",Z(r.profitRate),D(r.profitRate))])}function gt(t){if(!c||c.points.length===0||!T)return;const e=s.getBoundingClientRect(),r=(t.clientX-e.left)/e.width*T.width,n=vt(T.xPositions,r);n!==g&&(g=n,q(c),U(c))}function xt(){if(!c||c.points.length===0)return;const t=c.points.length-1;g!==t&&(g=t,q(c),U(c))}function m(t,e,r){return`
    <article class="metric">
      <p class="metric-label">${t}</p>
      <p class="metric-value ${r}">${e}</p>
    </article>
  `}function W(t){return t.join("")}function D(t){return t>0?"positive":t<0?"negative":"neutral"}function w(t){return new Intl.NumberFormat("zh-CN",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(t)}function Z(t){return new Intl.NumberFormat("zh-CN",{style:"percent",maximumFractionDigits:2,minimumFractionDigits:2}).format(t)}function et(t){return new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(t)}function k(t,e){const r=Math.round((V(t)+V(e))/2);return new Date(r).toISOString().slice(0,10)}function V(t){return Date.parse(`${t}T00:00:00Z`)}function vt(t,e){if(t.length<=1||e<=t[0])return 0;const r=t.length-1;if(e>=t[r])return r;let n=0,i=r;for(;n<i;){const x=Math.floor((n+i)/2);t[x]<e?n=x+1:i=x}const o=t[n],u=t[n-1];return Math.abs(o-e)<Math.abs(u-e)?n:n-1}function l(t,e={}){const r=document.createElementNS(lt,t);for(const[n,i]of Object.entries(e))r.setAttribute(n,i);return r}
