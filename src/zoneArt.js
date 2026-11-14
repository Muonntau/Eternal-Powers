import { assetUrl } from "./assetUrl.js";
export function zoneArt(zone = {}) {
  const name = `${zone.name || ""} ${zone.id || ""}`.toLowerCase();
  let index = /observator|light.fields/.test(name)
    ? 8
    : /librar|knowledge/.test(name)
      ? 9
      : /labyrinth|chasm|ruin|despair|suffering/.test(name)
        ? 11
        : /malevolence.forest|wasteland|forsaken/.test(name)
          ? 10
          : /mountain/.test(name)
            ? 5
            : /waterfall|lakes|water/.test(name)
              ? 4
              : /desert/.test(name)
                ? 3
                : /garden|grove|zen/.test(name)
                  ? /grove/.test(name)
                    ? 0
                    : 6
                  : zone.realm === "hell"
                    ? 2
                    : zone.realm === "heaven"
                      ? 1
                      : /settlement|city|cities|market/.test(name)
                        ? 7
                        : 0;
  return {
    backgroundImage: `url("${assetUrl("/assets/world-illustration-atlas.png")}")`,
    backgroundSize: "400% 300%",
    backgroundPosition: `${((index % 4) / 3) * 100}% ${(Math.floor(index / 4) / 2) * 100}%`,
  };
}
