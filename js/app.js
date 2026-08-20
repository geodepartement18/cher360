import Portal from "https://js.arcgis.com/4.34/@arcgis/core/portal/Portal.js";
import FeatureLayer from "https://js.arcgis.com/4.34/@arcgis/core/layers/FeatureLayer.js";
import Map from "https://js.arcgis.com/4.34/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.34/@arcgis/core/views/MapView.js";
import { CONFIG } from "./config.js";

const $ = id => document.getElementById(id);
const state = { portal:null, all:[], filtered:[], page:1 };

function esc(v="") {
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function norm(v="") {
  return String(v).normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
}
function formatDate(v) {
  return v ? new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(v)) : "Non renseignée";
}
function categories(i) {
  return (i.categories||[]).map(x=>String(x).split("/").filter(Boolean).pop()).filter(Boolean);
}
function tags(i) { return Array.isArray(i.tags) ? i.tags : []; }
function description(i) { return i.description || i.snippet || "Aucune description disponible."; }

async function loadGroupItems() {
  let start=1, items=[];
  while(start!==-1 && items.length<CONFIG.maxItems) {
    const r=await state.portal.queryItems({
      query:`group:${CONFIG.groupId}`, start, num:100,
      sortField:"modified", sortOrder:"desc"
    });
    items.push(...r.results.filter(i=>CONFIG.allowedTypes.includes(i.type)));
    if(r.nextStart===-1 || !r.results.length) break;
    start=r.nextStart;
  }
  return items;
}

function fillSelect(id, values) {
  const s=$(id), current=s.value;
  s.innerHTML='<option value="">'+(id==="categoryFilter"?"Toutes": "Tous")+'</option>';
  [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b,"fr")).forEach(v=>{
    const o=document.createElement("option"); o.value=v; o.textContent=v; s.appendChild(o);
  });
  if([...s.options].some(o=>o.value===current)) s.value=current;
}

function populateFilters() {
  fillSelect("categoryFilter",state.all.flatMap(categories));
  fillSelect("typeFilter",state.all.map(i=>i.type));
  fillSelect("ownerFilter",state.all.map(i=>i.owner||"Non renseigné"));
}

function applyFilters() {
  const q=norm($("searchInput").value);
  const cat=$("categoryFilter").value, type=$("typeFilter").value,
        owner=$("ownerFilter").value, sort=$("sortFilter").value;

  let r=state.all.filter(i=>{
    const hay=norm([i.title,description(i),i.owner,i.type,...tags(i),...categories(i)].join(" "));
    return (!q||hay.includes(q)) &&
           (!cat||categories(i).includes(cat)) &&
           (!type||i.type===type) &&
           (!owner||(i.owner||"Non renseigné")===owner);
  });

  r.sort((a,b)=>{
    if(sort==="title-asc") return (a.title||"").localeCompare(b.title||"","fr");
    if(sort==="title-desc") return (b.title||"").localeCompare(a.title||"","fr");
    if(sort==="created-desc") return (b.created||0)-(a.created||0);
    return (b.modified||0)-(a.modified||0);
  });

  state.filtered=r; state.page=1; render();
}

function card(i) {
  const thumb=i.thumbnailUrl||`${CONFIG.portalUrl.replace(/\/+$/,"")}/home/images/noThumbnail.png`;
  const cat=categories(i)[0]||"Donnée";
  return `<div class="col">
    <div class="card h-100 shadow-sm dataset-card">
      <img src="${esc(thumb)}" class="card-img-top dataset-thumbnail" alt="${esc(i.title||"Donnée")}" loading="lazy">
      <div class="card-body d-flex flex-column">
        <div class="mb-2">
          <span class="badge text-bg-primary">${esc(cat)}</span>
          <span class="badge text-bg-secondary">${esc(i.type||"Autre")}</span>
        </div>
        <h5 class="card-title">${esc(i.title||"Sans titre")}</h5>
        <p class="small text-secondary mb-2">${esc(i.owner||"Producteur non renseigné")}</p>
        <p class="card-text description flex-grow-1">${esc(description(i))}</p>
        <small class="text-secondary">Mis à jour le ${esc(formatDate(i.modified))}</small>
      </div>
      <div class="card-footer bg-white border-0">
        <button class="btn btn-primary w-100" data-open="${esc(i.id)}">Consulter</button>
      </div>
    </div>
  </div>`;
}

function render() {
  const total=state.filtered.length, size=CONFIG.pageSize, pages=Math.max(1,Math.ceil(total/size));
  state.page=Math.min(state.page,pages);
  const start=(state.page-1)*size;
  $("resultCount").textContent=`${total} jeu${total>1?"x":""} de données`;
  $("datasetGrid").innerHTML=state.filtered.slice(start,start+size).map(card).join("");

  if(!total) $("datasetGrid").innerHTML=`<div class="col-12"><div class="alert alert-warning">Aucune donnée ne correspond aux critères.</div></div>`;

  const p=$("pagination"); p.innerHTML="";
  if(pages<=1) return;

  for(let n=1;n<=pages;n++) {
    const li=document.createElement("li");
    li.className=`page-item ${n===state.page?"active":""}`;
    li.innerHTML=`<button class="page-link">${n}</button>`;
    li.querySelector("button").addEventListener("click",()=>{state.page=n;render();window.scrollTo({top:$("catalogue").offsetTop-20,behavior:"smooth"});});
    p.appendChild(li);
  }
}

function serviceLinks(i) {
  const base=CONFIG.portalUrl.replace(/\/+$/,""), links=[];
  if(i.url) {
    links.push({label:"Service REST",url:i.url});
    if(i.type==="Feature Service" && /FeatureServer/i.test(i.url)) {
      const layer=i.url.replace(/\/+$/,"")+"/0";
      links.push({label:"GeoJSON",url:`${layer}/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson`});
      links.push({label:"CSV",url:`${layer}/query?where=1%3D1&outFields=*&returnGeometry=false&f=csv`});
    }
  }
  links.push({label:"Fiche ArcGIS Online",url:`${base}/home/item.html?id=${i.id}`});
  return links;
}

async function openDataset(i) {
  const thumb=i.thumbnailUrl||`${CONFIG.portalUrl.replace(/\/+$/,"")}/home/images/noThumbnail.png`;
  $("modalTitle").textContent=i.title||"Jeu de données";

  $("modalContent").innerHTML=`
    <div class="row g-4">
      <div class="col-lg-4">
        <img src="${esc(thumb)}" class="img-fluid rounded detail-thumbnail" alt="${esc(i.title||"Donnée")}">
      </div>
      <div class="col-lg-8">
        <h2>${esc(i.title||"Sans titre")}</h2>
        <p class="lead">${esc(description(i))}</p>
        <dl class="row">
          <dt class="col-sm-4">Producteur</dt><dd class="col-sm-8">${esc(i.owner||"Non renseigné")}</dd>
          <dt class="col-sm-4">Type</dt><dd class="col-sm-8">${esc(i.type||"Non renseigné")}</dd>
          <dt class="col-sm-4">Création</dt><dd class="col-sm-8">${esc(formatDate(i.created))}</dd>
          <dt class="col-sm-4">Mise à jour</dt><dd class="col-sm-8">${esc(formatDate(i.modified))}</dd>
          <dt class="col-sm-4">Licence</dt><dd class="col-sm-8">${esc(i.licenseInfo||"Non renseignée")}</dd>
          <dt class="col-sm-4">Source / crédit</dt><dd class="col-sm-8">${esc(i.accessInformation||"Non renseigné")}</dd>
        </dl>
        <h5>Thématiques</h5>
        <div class="mb-3">${categories(i).map(x=>`<span class="badge text-bg-light border me-1">${esc(x)}</span>`).join("")||"Non renseignées"}</div>
        <h5>Mots-clés</h5>
        <div class="mb-3">${tags(i).map(x=>`<span class="badge text-bg-light border me-1">${esc(x)}</span>`).join("")||"Non renseignés"}</div>
        <h5>Accès aux données</h5>
        <div class="d-flex flex-wrap gap-2">
          ${serviceLinks(i).map(x=>`<a class="btn btn-outline-primary" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a>`).join("")}
        </div>
      </div>
    </div>
    <hr class="my-4">
    <h4>Aperçu cartographique</h4>
    <div id="mapPreview" class="map-preview"></div>
    <div id="mapMessage" class="text-secondary mt-2"></div>
  `;

  bootstrap.Modal.getOrCreateInstance($("datasetModal")).show();
  await createMap(i);
}

async function createMap(i) {
  const node=$("mapPreview"), msg=$("mapMessage");
  if(i.type!=="Feature Service" || !i.url) {
    node.style.display="none";
    msg.textContent="L'aperçu cartographique est disponible pour les Feature Services.";
    return;
  }

  try {
    const layer=new FeatureLayer({portalItem:{id:i.id,portal:state.portal}});
    await layer.load();

    const map=new Map({basemap:"topo-vector",layers:[layer]});
    const view=new MapView({
      container:node,map,
      center:[2.4,46.6],zoom:5,
      ui:{components:["zoom","attribution"]}
    });

    await view.when();
    if(layer.fullExtent) await view.goTo(layer.fullExtent.expand(1.2),{animate:false});
  } catch(e) {
    console.warn(e);
    node.style.display="none";
    msg.textContent="Impossible d'afficher la carte pour cette donnée.";
  }
}

async function load() {
  $("loader").classList.remove("d-none");
  $("errorNotice").classList.add("d-none");
  try {
    if(!CONFIG.groupId || CONFIG.groupId==="REMPLACEZ_PAR_ID_DU_GROUPE")
      throw new Error("Renseignez l'ID du groupe dans js/config.js.");

    state.portal=new Portal({url:CONFIG.portalUrl});
    state.portal.authMode="anonymous";
    await state.portal.load();

    state.all=await loadGroupItems();
    populateFilters();
    applyFilters();
  } catch(e) {
    console.error(e);
    $("errorNotice").classList.remove("d-none");
    $("errorMessage").textContent=e.message;
  } finally {
    $("loader").classList.add("d-none");
  }
}

["categoryFilter","typeFilter","ownerFilter","sortFilter"].forEach(id=>$(id).addEventListener("change",applyFilters));
$("searchInput").addEventListener("input",applyFilters);

$("resetButton").addEventListener("click",()=>{
  $("searchInput").value="";
  $("categoryFilter").value="";
  $("typeFilter").value="";
  $("ownerFilter").value="";
  $("sortFilter").value="modified-desc";
  applyFilters();
});
$("reloadButton").addEventListener("click",load);
$("datasetGrid").addEventListener("click",e=>{
  const b=e.target.closest("[data-open]");
  if(b) {
    const i=state.all.find(x=>x.id===b.dataset.open);
    if(i) openDataset(i);
  }
});

load();
