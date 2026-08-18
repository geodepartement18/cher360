# Portail Open Data ArcGIS Online

Application web autonome HTML + JavaScript + ArcGIS Maps SDK for JavaScript + Calcite Components.

## 1. Configuration

Ouvrez :

    js/config.js

et remplacez :

    groupId: "REMPLACEZ_PAR_ID_DU_GROUPE",

par l'ID de votre groupe ArcGIS Online.

Exemple :

    groupId: "0123456789abcdef0123456789abcdef",

Le groupe doit contenir les éléments que vous souhaitez publier dans le catalogue.

## 2. Lancer l'application

Ne lancez pas `index.html` directement avec `file://`.

Utilisez un petit serveur HTTP.

Avec Python :

    python -m http.server 8000

Puis ouvrez :

    http://localhost:8000/

## 3. Publication

Le dossier peut être publié sur n'importe quel hébergement statique compatible HTTPS :

- serveur web
- IIS
- Apache
- Nginx
- GitHub Pages
- Azure Static Web Apps
- hébergement de site classique

## 4. Fonctionnalités

- catalogue alimenté par un groupe ArcGIS Online
- recherche plein texte
- filtre par thématique
- filtre par type
- filtre par producteur
- tri par date ou titre
- pagination
- miniature ArcGIS Online
- fiche détaillée
- métadonnées
- lien vers la fiche ArcGIS Online
- lien vers le service REST
- aperçu cartographique pour les Feature Services
- lien GeoJSON pour les Feature Services

## 5. Accès public

L'application est configurée avec :

    portal.authMode = "anonymous";

Elle fonctionne donc sans connexion pour les contenus publics.

Si votre groupe ou vos données sont privés, il faudra ajouter une authentification ArcGIS Identity/OAuth.

## 6. Organisation recommandée du groupe

Pour un vrai portail Open Data, je recommande de mettre dans le groupe uniquement les éléments destinés à être publiés.

Exemples :

- Feature Service
- CSV
- Shapefile
- GeoJSON
- WFS
- WMS
- Map Service
- Vector Tile Service

Les métadonnées ArcGIS Online (`title`, `description`, `tags`, `categories`, `accessInformation`, `licenseInfo`, etc.) servent directement à alimenter les fiches.

## 7. Attention aux téléchargements

Le bouton GeoJSON construit une requête REST sur la couche 0 d'un Feature Service.

Pour une production Open Data, il est préférable de prévoir des services correctement configurés et, si nécessaire, de générer des fichiers de téléchargement dédiés (CSV, GeoJSON, SHP, etc.) plutôt que de charger toute une couche volumineuse dans une seule requête.

## 8. Sources techniques

La documentation officielle du SDK confirme que `Portal.queryItems()` permet de rechercher les éléments d'un portail et que `PortalItem` expose notamment le titre, la description, les tags, le type, l'URL et la miniature.

Le SDK permet également de créer une couche à partir d'un élément Portal et de l'afficher dans une carte.
