import Portal from "https://js.arcgis.com/4.34/@arcgis/core/portal/Portal.js";
import FeatureLayer from "https://js.arcgis.com/4.34/@arcgis/core/layers/FeatureLayer.js";
import Map from "https://js.arcgis.com/4.34/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.34/@arcgis/core/views/MapView.js";
import Layer from "https://js.arcgis.com/4.34/@arcgis/core/layers/Layer.js";
import { CONFIG } from "./config.js";

const state = {
  portal: null,
  allItems: [],
  filteredItems: [],
  currentPage: 1
};

const $ = (id) => document.getElementById(id);

const loader = $("loader");
const grid = $("datasetGrid");
const pagination = $("pagination");
const errorNotice = $("errorNotice");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(timestamp));
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function getDescription(item) {
  return item.description || item.snippet || "Aucune description disponible.";
}

function getCategories(item) {
  // Les catégories peuvent être absentes selon la manière dont le groupe
  // ou les éléments ont été configurés.
  const categories = item.categories || [];
  return categories.map((c) => String(c).split("/").filter(Boolean).pop()).filter(Boolean);
}

function getTags(item) {
  return Array.isArray(item.tags) ? item.tags : [];
}

function getDownloadLinks(item) {
  const links = [];
  const url = item.url;

  if (url) {
    links.push({
      label: "API / Service REST",
      href: url,
      icon: "services"
    });

    if (item.type === "Feature Service" && /FeatureServer/i.test(url)) {
      const layerUrl = url.replace(/\/+$/, "") + "/0";
      const geojson = layerUrl +
        "/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson";

      links.push({
        label: "GeoJSON",
        href: geojson,
        icon: "download"
      });

      const csv = layerUrl +
        "/query?where=1%3D1&outFields=*&returnGeometry=false&f=geojson";

      links.push({
        label: "Données",
        href: csv,
        icon: "table"
      });
    }
  }

  links.push({
    label: "Fiche ArcGIS Online",
    href: `${CONFIG.portalUrl.replace(/\/+$/, "")}/home/item.html?id=${item.id}`,
    icon: "launch"
  });

  return links;
}

async function loadAllGroupItems() {
  let start = 1;
  const num = 100;
  const items = [];

  while (start !== -1 && items.length < CONFIG.maxItems) {
    const result = await state.portal.queryItems({
      query: `group:${CONFIG.groupId}`,
      start,
      num,
      sortField: "modified",
      sortOrder: "desc"
    });

    for (const item of result.results) {
      if (CONFIG.allowedTypes.includes(item.type)) {
        items.push(item);
      }
    }

    if (result.nextStart === -1 || !result.results.length) {
      break;
    }

    start = result.nextStart;
  }

  return items;
}

function populateFilters(items) {
  const categories = new Set();
  const owners = new Set();
  const types = new Set();

  items.forEach((item) => {
    getCategories(item).forEach((c) => categories.add(c));
    owners.add(item.owner || "Non renseigné");
    types.add(item.type || "Autre");
  });

  fillSelect($("categoryFilter"), [...categories].sort((a, b) => a.localeCompare(b, "fr")));
  fillSelect($("ownerFilter"), [...owners].sort((a, b) => a.localeCompare(b, "fr")));
  fillSelect($("typeFilter"), [...types].sort((a, b) => a.localeCompare(b, "fr")));
}

function fillSelect(select, values) {
  const first = select.querySelector("calcite-option");
  select.innerHTML = "";
  select.appendChild(first);

  values.forEach((value) => {
    const option = document.createElement("calcite-option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function applyFilters() {
  const search = normalizeText($("searchInput").value);
  const category = $("categoryFilter").value;
  const type = $("typeFilter").value;
  const owner = $("ownerFilter").value;
  const sort = $("sortFilter").value;

  let result = state.allItems.filter((item) => {
    const searchable = normalizeText([
      item.title,
      getDescription(item),
      item.owner,
      item.type,
      ...getTags(item),
      ...getCategories(item)
    ].join(" "));

    const matchSearch = !search || searchable.includes(search);
    const matchCategory = !category || getCategories(item).includes(category);
    const matchType = !type || item.type === type;
    const matchOwner = !owner || (item.owner || "Non renseigné") === owner;

    return matchSearch && matchCategory && matchType && matchOwner;
  });

  result = [...result].sort((a, b) => {
    if (sort === "title-asc") {
      return (a.title || "").localeCompare(b.title || "", "fr");
    }
    if (sort === "title-desc") {
      return (b.title || "").localeCompare(a.title || "", "fr");
    }
    if (sort === "created-desc") {
      return (b.created || 0) - (a.created || 0);
    }
    return (b.modified || 0) - (a.modified || 0);
  });

  state.filteredItems = result;
  state.currentPage = 1;
  render();
}

function render() {
  const total = state.filteredItems.length;
  const pageSize = CONFIG.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (state.currentPage > totalPages) {
    state.currentPage = totalPages;
  }

  const start = (state.currentPage - 1) * pageSize;
  const pageItems = state.filteredItems.slice(start, start + pageSize);

  $("resultCount").textContent =
    `${total} jeu${total > 1 ? "x" : ""} de données`;

  grid.innerHTML = pageItems.map(createCardHtml).join("");

  pagination.totalItems = total;
  pagination.pageSize = pageSize;
  pagination.startItem = start + 1;

  if (total === 0) {
    grid.innerHTML = `
      <calcite-notice open kind="warning">
        <div slot="title">Aucun résultat</div>
        <div slot="message">
          Modifiez vos critères de recherche ou réinitialisez les filtres.
        </div>
      </calcite-notice>
    `;
  }
}

function createCardHtml(item) {
  const thumbnail = item.thumbnailUrl ||
    `${CONFIG.portalUrl.replace(/\/+$/, "")}/home/images/noThumbnail.png`;

  const categories = getCategories(item);
  const category = categories[0] || "Donnée";

  return `
    <calcite-card class="dataset-card">
      <img
        slot="thumbnail"
        class="dataset-thumbnail"
        src="${escapeHtml(thumbnail)}"
        alt="${escapeHtml(item.title || "Donnée")}"
        loading="lazy">

      <span slot="heading">${escapeHtml(item.title || "Sans titre")}</span>
      <span slot="subheading">
        ${escapeHtml(item.owner || "Producteur non renseigné")}
      </span>

      <div class="card-body">
        <calcite-chip scale="s">${escapeHtml(category)}</calcite-chip>
        <calcite-chip scale="s">${escapeHtml(item.type || "Autre")}</calcite-chip>

        <p class="description">
          ${escapeHtml(getDescription(item))}
        </p>

        <div class="metadata">
          <span>Mis à jour le ${escapeHtml(formatDate(item.modified))}</span>
        </div>
      </div>

      <calcite-button
        slot="footer-end"
        appearance="solid"
        icon-start="launch"
        data-action="open"
        data-id="${escapeHtml(item.id)}">
        Consulter
      </calcite-button>
    </calcite-card>
  `;
}

function openDataset(item) {
  const modal = $("datasetModal");
  const modalContent = $("modalContent");

  const thumbnail = item.thumbnailUrl ||
    `${CONFIG.portalUrl.replace(/\/+$/, "")}/home/images/noThumbnail.png`;

  const tags = getTags(item);
  const categories = getCategories(item);
  const links = getDownloadLinks(item);

  modal.heading = item.title || "Jeu de données";

  modalContent.innerHTML = `
    <div class="detail-grid">
      <div>
        <img class="detail-thumbnail"
             src="${escapeHtml(thumbnail)}"
             alt="${escapeHtml(item.title || "Donnée")}">
      </div>

      <div>
        <h2>${escapeHtml(item.title || "Sans titre")}</h2>

        <p class="lead">
          ${escapeHtml(getDescription(item))}
        </p>

        <dl class="metadata-list">
          <dt>Producteur</dt>
          <dd>${escapeHtml(item.owner || "Non renseigné")}</dd>

          <dt>Type</dt>
          <dd>${escapeHtml(item.type || "Non renseigné")}</dd>

          <dt>Création</dt>
          <dd>${escapeHtml(formatDate(item.created))}</dd>

          <dt>Dernière mise à jour</dt>
          <dd>${escapeHtml(formatDate(item.modified))}</dd>

          <dt>Accès</dt>
          <dd>${escapeHtml(item.access || "Non renseigné")}</dd>

          <dt>Licence</dt>
          <dd>${escapeHtml(item.licenseInfo || "Non renseignée")}</dd>

          <dt>Source / crédit</dt>
          <dd>${escapeHtml(item.accessInformation || "Non renseigné")}</dd>
        </dl>

        <h3>Thématiques</h3>
        <div class="chips">
          ${categories.length
            ? categories.map((c) => `<calcite-chip>${escapeHtml(c)}</calcite-chip>`).join("")
            : "<span>Non renseignées</span>"}
        </div>

        <h3>Mots-clés</h3>
        <div class="chips">
          ${tags.length
            ? tags.map((t) => `<calcite-chip scale="s">${escapeHtml(t)}</calcite-chip>`).join("")
            : "<span>Non renseignés</span>"}
        </div>

        <h3>Accès aux données</h3>
        <div class="actions">
          ${links.map((link) => `
            <calcite-button
              appearance="outline"
              icon-start="${escapeHtml(link.icon)}"
              data-link="${escapeHtml(link.href)}">
              ${escapeHtml(link.label)}
            </calcite-button>
          `).join("")}
        </div>
      </div>
    </div>

    <div id="mapPreviewContainer" class="map-preview-container">
      <h3>Aperçu cartographique</h3>
      <div id="mapPreview" class="map-preview"></div>
      <div id="mapMessage" class="muted"></div>
    </div>
  `;

  modal.open = true;

  modalContent.querySelectorAll("[data-link]").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(button.dataset.link, "_blank", "noopener,noreferrer");
    });
  });

  createMapPreview(item);
}

async function createMapPreview(item) {
  const mapNode = $("mapPreview");
  const message = $("mapMessage");

  if (!mapNode) return;

  if (item.type !== "Feature Service") {
    mapNode.style.display = "none";
    message.textContent =
      "Aperçu cartographique disponible uniquement pour les Feature Services dans cette version.";
    return;
  }

  if (!item.url) {
    mapNode.style.display = "none";
    message.textContent = "Aucune URL de service disponible.";
    return;
  }

  try {
    const layer = new FeatureLayer({
      portalItem: {
        id: item.id,
        portal: state.portal
      },
      outFields: ["*"]
    });

    await layer.load();

    const map = new Map({
      basemap: "topo-vector",
      layers: [layer]
    });

    const view = new MapView({
      container: mapNode,
      map,
      center: [2.4, 46.6],
      zoom: 5,
      ui: {
        components: ["zoom", "attribution"]
      }
    });

    await view.when();

    if (layer.fullExtent) {
      await view.goTo(layer.fullExtent.expand(1.2), {
        animate: false
      });
    }
  } catch (error) {
    console.warn("Aperçu cartographique indisponible :", error);
    mapNode.style.display = "none";
    message.textContent =
      "La carte n'a pas pu être affichée pour cette donnée.";
  }
}

async function initialize() {
  try {
    if (!CONFIG.groupId || CONFIG.groupId === "REMPLACEZ_PAR_ID_DU_GROUPE") {
      throw new Error(
        "Configurez l'ID du groupe ArcGIS Online dans js/config.js."
      );
    }

    $("brand").heading = CONFIG.siteTitle;
    $("brand").description = CONFIG.siteDescription;

    state.portal = new Portal({
      url: CONFIG.portalUrl
    });

    state.portal.authMode = "anonymous";

    await state.portal.load();

    state.allItems = await loadAllGroupItems();

    populateFilters(state.allItems);
    applyFilters();

    loader.hidden = true;
  } catch (error) {
    console.error(error);
    loader.hidden = true;
    errorNotice.open = true;
    $("errorMessage").textContent = error.message;
  }
}

// Recherche / filtres
$("searchInput").addEventListener("calciteInputInput", applyFilters);
$("categoryFilter").addEventListener("calciteSelectChange", applyFilters);
$("typeFilter").addEventListener("calciteSelectChange", applyFilters);
$("ownerFilter").addEventListener("calciteSelectChange", applyFilters);
$("sortFilter").addEventListener("calciteSelectChange", applyFilters);

$("resetButton").addEventListener("click", () => {
  $("searchInput").value = "";
  $("categoryFilter").value = "";
  $("typeFilter").value = "";
  $("ownerFilter").value = "";
  $("sortFilter").value = "modified-desc";
  applyFilters();
});

$("reloadButton").addEventListener("click", async () => {
  loader.hidden = false;
  errorNotice.open = false;

  try {
    state.allItems = await loadAllGroupItems();
    populateFilters(state.allItems);
    applyFilters();
  } catch (error) {
    errorNotice.open = true;
    $("errorMessage").textContent = error.message;
  } finally {
    loader.hidden = true;
  }
});

// Pagination Calcite
pagination.addEventListener("calcitePaginationChange", (event) => {
  state.currentPage = event.target.startItem
    ? Math.ceil(event.target.startItem / CONFIG.pageSize)
    : 1;
  render();
});

// Ouverture des fiches
grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='open']");
  if (!button) return;

  const item = state.allItems.find((i) => i.id === button.dataset.id);
  if (item) openDataset(item);
});

$("closeModalButton").addEventListener("click", () => {
  $("datasetModal").open = false;
});

$("aboutButton").addEventListener("click", () => {
  $("aboutModal").open = true;
});

$("closeAboutButton").addEventListener("click", () => {
  $("aboutModal").open = false;
});

initialize();
