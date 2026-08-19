// ============================================================
// CONFIGURATION DU PORTAIL OPEN DATA
// ============================================================

// ID du groupe ArcGIS Online contenant les jeux de données.
// Exemple : "0123456789abcdef0123456789abcdef"
export const CONFIG = {
  portalUrl: "https://cher.maps.arcgis.com/",
  groupId: "a249c493cd4d44c39c6565d996cb83d6",

  // Nombre maximal d'éléments chargés depuis le groupe.
  // Le catalogue utilise ensuite une pagination côté navigateur.
  maxItems: 10,

  // Nombre de jeux de données affichés par page.
  pageSize: 12,

  // Types considérés comme des données Open Data.
  allowedTypes: [
    "Feature Service",
    "CSV",
    "Shapefile",
    "GeoJson",
    "KML",
    "WFS",
    "WMS",
    "Map Service",
    "Vector Tile Service",
    "Scene Service",
    "Image Service",
    "File Geodatabase"
  ],

  // Titre et sous-titre affichés dans l'en-tête.
  siteTitle: "Portail Open Data",
  siteDescription: "Catalogue de données publiques"
};
