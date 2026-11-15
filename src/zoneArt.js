import { assetUrl } from "./assetUrl.js";
export function zoneArt(zone = {}) {
  return {
    backgroundImage: `url("${assetUrl(`/assets/v2/regions/${zone.id || "sacred-groves"}.svg`)}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}
