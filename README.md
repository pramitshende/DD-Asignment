# Town C2 Awareness COP (Cesium MVP)

A lightweight Cesium-based common operating picture (COP) for a small-town search-and-rescue design challenge.

## MVP Features

- **Operator COP on globe** for situational awareness.
- **Community Missing Intake**: create missing person alerts that appear on the map.
- **Community Path Plan Intake**: capture planned hikes/expeditions and render route lines.
- **Sensor integration layer** for:
  - Sentry tower thermal camera
  - Meshtastic repeater tower
  - Loaner Meshtastic trackers
  - Laser perimeter fence zones
- **Waypoint placement** for shelter regions, muster points, and medical points.
- **Drone operations**:
  - Launch and target selection via map clicks
  - 3D drone mission path
  - Approximate camera field-of-view cone
  - Mock thermal feed panel
- **Dispatch panel** for assigning resources (SAR teams, drone, RECCO helicopter) to active alerts.

## Run

Because this MVP uses browser JavaScript modules/assets, run it from a local static server:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080`

## Troubleshooting

If the globe does not appear:

- Ensure you are using `http://localhost:8080` (not opening `index.html` directly as a file).
- Ensure internet access is available (Cesium assets and terrain/imagery are loaded from Cesium ion CDN).
- Check the top-right status banner in the app for a load error message.

## Notes

- Uses Cesium via CDN (`unpkg`) for quick MVP setup.
- Uses Cesium ion token configured in `app.js` for Cesium World Terrain/imagery startup.
- Drone thermal stream is a simulated heatmap for UI/demo purposes.


## Security note

- The access token is currently embedded for MVP convenience; rotate/regenerate if this repo is shared publicly.
