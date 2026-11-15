import { assetUrl } from "./assetUrl.js";
// Eight original generated landscape plates, cropped consistently across realm cards.
export function zoneArt(zone = {}) {
  const id = zone.id || "sacred-groves";
  const realm = String(zone.realm || "earth").toLowerCase();
  let atlas = "earth",
    panel = 0;
  if (id === "city-of-stars" || /star|astral|nexus|cosmic/.test(id)) {
    atlas = "cosmic";
    panel = 3;
  } else if (
    realm.includes("hell") ||
    /infernal|suffering|damnation|abyss|torment|sin-|blood|ash/.test(id)
  ) {
    atlas = "cosmic";
    panel = 2;
  } else if (
    realm.includes("heaven") ||
    /celestial|ethereal|divine|seraph|paradise/.test(id)
  ) {
    atlas = "cosmic";
    panel = /observ|archive|garden/.test(id) ? 1 : 0;
  } else if (/water|coast|river|lake|sea|ocean|prismatic/.test(id)) panel = 1;
  else if (/desert|dune|sand|arid/.test(id)) panel = 2;
  else if (/city|town|capital|urban|village/.test(id)) panel = 3;
  return {
    backgroundImage: `url("${assetUrl(`/assets/v3/${atlas}-atlas.png`)}")`,
    backgroundSize: "200% auto",
    backgroundPosition: `${panel % 2 ? 100 : 0}% ${panel > 1 ? 100 : 0}%`,
  };
}
