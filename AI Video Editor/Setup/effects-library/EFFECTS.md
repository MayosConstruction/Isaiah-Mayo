# Effects library

The 17 effects from the "17 video effects claude can create" reel, matched to the closest
HyperFrames registry item. Each one is installed as editable source in `compositions/`. Copy the
file (and anything in `assets/` it uses) into a project and mount it, or run
`hyperframes add <name>` inside the project.

| # | Effect in the reel | HyperFrames item | Match |
|---|---|---|---|
| 01 | orbit | `radial-surround` (labels circle the subject) | close |
| 02 | couch wall | `mk-clone-wall-transition` (tiled wall covers the frame) | close |
| 03 | UI world | `app-showcase` (floating phone screens) | close |
| 04 | frame break | `freeze-frame-dressing` (cut-out subject with paper and tape) | partial: needs a background-removed subject |
| 05 | digital zoom | `cinematic-zoom` (zoom-blur cut) | close |
| 06 | phone mockup | `vfx-iphone-device` (real 3D iPhone with live screen) | close |
| 07 | checklist | `components/marker-checklist-card` | close |
| 08 | headline wall | `canopy-part-title` | partial |
| 09 | zoom-through cut | `components/zoom-through-transition` | same effect |
| 10 | chart grow | `data-chart` | same effect |
| 11 | pull-back reveal | `components/parallax-unzoom` | same effect |
| 12 | green screen | background removal through `/media-use` (cutouts) | needs its model; blocked in the cloud workspace |
| 13 | paper cut | `components/paper-collage-reveal` | close |
| 14 | doodle boil | `components/hw-boil` + `hw-frame` | same effect |
| 15 | vertigo | `camera-dolly-zoom` | same effect |
| 16 | cover story | `transitions-cover` | partial: a magazine-cover title is better built from Signature Style fonts |
| 17 | glass type | `glass-hero` (`glass-shard-title` couldn't download: its images host is blocked) | close |

## Offline status
- GSAP points at the local `assets/gsap.min.js` in every file.
- Still online-only (fine on a normal computer, blocked in the cloud workspace): the 3D ones
  (`vfx-iphone-device`, `glass-hero`, `camera-dolly-zoom` use three.js from jsDelivr) and Google
  Fonts in `canopy-part-title`, `app-showcase`, `cinematic-zoom`, `data-chart`, `glass-hero`.
- `hyperframes lint`: 0 errors, 4 warnings (cosmetic, in `vfx-iphone-device`).
