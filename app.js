const ION_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJiY2QxZmFjYi01NTc2LTQxNzYtYTEwZC1mMjVkMzExNzE0MDMiLCJpZCI6MzkxNTA2LCJpYXQiOjE3NzEzNzE1MTl9.u5Q0BS9R8gk6eyAyb5ZlvahMmovvyT722UChflne3z4";

const cesiumStatus = document.createElement("div");
cesiumStatus.id = "cesium-status";
cesiumStatus.textContent = "Loading Cesium COP...";
document.body.appendChild(cesiumStatus);

function setStatus(text, isError = false) {
  cesiumStatus.textContent = text;
  cesiumStatus.classList.toggle("error", isError);
}

function initializeApp() {
  if (!window.Cesium) {
    setStatus("Cesium failed to load. Check internet access and Cesium ion token/configuration.", true);
    return;
  }

  Cesium.Ion.defaultAccessToken = ION_ACCESS_TOKEN;

  const viewer = new Cesium.Viewer("cesiumContainer", {
    terrainProvider: Cesium.createWorldTerrain(),
    timeline: false,
    animation: false,
    baseLayerPicker: true,
    sceneModePicker: false,
    geocoder: false,
  });

  viewer.scene.globe.depthTestAgainstTerrain = true;

  const townCenter = Cesium.Cartesian3.fromDegrees(-86.25, 57.13, 60);
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-86.25, 57.13, 18000),
  });

  const state = {
    alerts: [],
    paths: [],
    sensors: [],
    dispatches: [],
    waypoints: [],
    selectedAlertId: null,
    clickMode: null,
    pathDraft: { start: null, end: null },
    droneDraft: { start: null, end: null },
    droneMission: null,
  };

  const refs = {
    eventFeed: document.getElementById("event-feed"),
    dispatchList: document.getElementById("dispatch-list"),
    pathStatus: document.getElementById("path-status"),
    droneStatus: document.getElementById("drone-status"),
  };

  function addEvent(text, level = "ok") {
    const item = document.createElement("div");
    item.className = "list-item";
    const badgeClass = level === "danger" ? "badge-danger" : "badge-ok";
    item.innerHTML = `${new Date().toLocaleTimeString()} ${text}<span class="badge ${badgeClass}">${level.toUpperCase()}</span>`;
    refs.eventFeed.prepend(item);
  }

  function updateStats() {
    document.getElementById("stat-alerts").textContent = state.alerts.length;
    document.getElementById("stat-paths").textContent = state.paths.length;
    document.getElementById("stat-sensors").textContent = state.sensors.length;
    document.getElementById("stat-dispatch").textContent = state.dispatches.length;
  }

  function getMapCenter() {
    const ray = viewer.camera.getPickRay(
      new Cesium.Cartesian2(
        viewer.canvas.clientWidth / 2,
        viewer.canvas.clientHeight / 2,
      ),
    );
    return viewer.scene.globe.pick(ray, viewer.scene) || townCenter;
  }

  function colorByUrgency(urgency) {
    switch (urgency) {
      case "Critical": return Cesium.Color.RED;
      case "High": return Cesium.Color.ORANGERED;
      case "Medium": return Cesium.Color.YELLOW;
      default: return Cesium.Color.LIME;
    }
  }

  function toCartographicStrings(cartesian) {
    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    return {
      lon: Cesium.Math.toDegrees(carto.longitude).toFixed(4),
      lat: Cesium.Math.toDegrees(carto.latitude).toFixed(4),
    };
  }

  document.getElementById("missing-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const alert = {
      id: crypto.randomUUID(),
      name: form.get("name"),
      lastSeen: form.get("lastSeen"),
      urgency: form.get("urgency"),
      pos: getMapCenter(),
    };
    state.alerts.push(alert);
    state.selectedAlertId = alert.id;

    viewer.entities.add({
      id: `alert-${alert.id}`,
      position: alert.pos,
      point: {
        pixelSize: 12,
        color: colorByUrgency(alert.urgency),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      },
      label: {
        text: `MISSING: ${alert.name} (${alert.urgency})`,
        pixelOffset: new Cesium.Cartesian2(0, -22),
        fillColor: colorByUrgency(alert.urgency),
        showBackground: true,
        font: "14px sans-serif",
      },
    });

    addEvent(`Missing alert opened for ${alert.name}`, alert.urgency === "Critical" ? "danger" : "ok");
    updateStats();
    e.target.reset();
  });

  function updatePathStatus() {
    refs.pathStatus.textContent = `Start: ${state.pathDraft.start ? "✓" : "—"} | End: ${state.pathDraft.end ? "✓" : "—"}`;
  }

  document.getElementById("path-start").addEventListener("click", () => {
    state.clickMode = "path-start";
    addEvent("Click map to set path start point");
  });
  document.getElementById("path-end").addEventListener("click", () => {
    state.clickMode = "path-end";
    addEvent("Click map to set path end point");
  });

  document.getElementById("path-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.pathDraft.start || !state.pathDraft.end) {
      addEvent("Path requires start and end points", "danger");
      return;
    }

    const form = new FormData(e.target);
    const path = {
      id: crypto.randomUUID(),
      owner: form.get("owner"),
      description: form.get("description"),
      start: state.pathDraft.start,
      end: state.pathDraft.end,
    };
    state.paths.push(path);

    viewer.entities.add({
      id: `path-${path.id}`,
      polyline: {
        positions: [path.start, path.end],
        width: 4,
        material: Cesium.Color.CYAN,
        clampToGround: true,
      },
    });

    const midpoint = Cesium.Cartesian3.midpoint(path.start, path.end, new Cesium.Cartesian3());
    viewer.entities.add({
      position: midpoint,
      label: {
        text: `Path: ${path.owner}`,
        fillColor: Cesium.Color.CYAN,
        showBackground: true,
        font: "12px sans-serif",
      },
    });

    addEvent(`Path plan submitted by ${path.owner}`);
    state.pathDraft = { start: null, end: null };
    updatePathStatus();
    updateStats();
    e.target.reset();
  });

  function sensorVisual(type) {
    if (type === "tower-thermal") return { color: Cesium.Color.ORANGE, radius: 350, icon: "🌡️" };
    if (type === "tower-mesh") return { color: Cesium.Color.DEEPSKYBLUE, radius: 900, icon: "📡" };
    if (type === "loaner-mesh") return { color: Cesium.Color.LAWNGREEN, radius: 300, icon: "🛰️" };
    return { color: Cesium.Color.RED, radius: 180, icon: "🚧" };
  }

  document.getElementById("sensor-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const type = form.get("type");
    const label = form.get("label");
    const pos = getMapCenter();
    const vis = sensorVisual(type);

    state.sensors.push({ id: crypto.randomUUID(), type, label, pos });

    viewer.entities.add({
      position: pos,
      point: {
        pixelSize: 10,
        color: vis.color,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
      },
      ellipse: {
        semiMajorAxis: vis.radius,
        semiMinorAxis: vis.radius,
        material: vis.color.withAlpha(0.2),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        clampToGround: true,
      },
      label: {
        text: `${vis.icon} ${label}`,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        fillColor: vis.color,
        showBackground: true,
        font: "12px sans-serif",
      },
    });

    addEvent(`Sensor deployed: ${label} (${type})`);
    updateStats();
    e.target.reset();
  });

  document.getElementById("waypoint-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const type = form.get("type");
    const label = form.get("label");
    const pos = getMapCenter();

    state.waypoints.push({ id: crypto.randomUUID(), type, label, pos });
    const color = type === "shelter" ? Cesium.Color.LIME : type === "muster" ? Cesium.Color.GOLD : Cesium.Color.AQUA;

    viewer.entities.add({
      position: pos,
      point: { pixelSize: 11, color },
      label: {
        text: `${type.toUpperCase()}: ${label}`,
        fillColor: color,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        showBackground: true,
      },
    });

    addEvent(`Waypoint placed: ${label} (${type})`);
    e.target.reset();
  });

  function updateDroneStatus() {
    refs.droneStatus.textContent = `Launch: ${state.droneDraft.start ? "✓" : "—"} | Target: ${state.droneDraft.end ? "✓" : "—"}`;
  }

  document.getElementById("drone-start").addEventListener("click", () => {
    state.clickMode = "drone-start";
    addEvent("Click map to set drone launch position");
  });
  document.getElementById("drone-end").addEventListener("click", () => {
    state.clickMode = "drone-end";
    addEvent("Click map to set drone target position");
  });

  document.getElementById("drone-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.droneDraft.start || !state.droneDraft.end) {
      addEvent("Drone mission needs launch and target", "danger");
      return;
    }

    if (state.droneMission?.entityIds) {
      state.droneMission.entityIds.forEach((id) => viewer.entities.removeById(id));
    }

    const form = new FormData(e.target);
    const altitude = Number(form.get("altitude"));
    const fov = Number(form.get("fov"));
    const callsign = form.get("name");

    const startCarto = Cesium.Cartographic.fromCartesian(state.droneDraft.start);
    const endCarto = Cesium.Cartographic.fromCartesian(state.droneDraft.end);
    const start3d = Cesium.Cartesian3.fromRadians(startCarto.longitude, startCarto.latitude, altitude);
    const end3d = Cesium.Cartesian3.fromRadians(endCarto.longitude, endCarto.latitude, altitude);

    const start = Cesium.JulianDate.now();
    const stop = Cesium.JulianDate.addSeconds(start, 180, new Cesium.JulianDate());
    const sampled = new Cesium.SampledPositionProperty();
    sampled.addSample(start, start3d);
    sampled.addSample(stop, end3d);

    const droneId = `drone-${crypto.randomUUID()}`;
    const pathId = `drone-path-${crypto.randomUUID()}`;
    const fovId = `drone-fov-${crypto.randomUUID()}`;

    viewer.entities.add({
      id: pathId,
      polyline: {
        positions: [start3d, end3d],
        width: 3,
        material: Cesium.Color.ORANGE,
      },
    });

    viewer.entities.add({
      id: droneId,
      availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]),
      position: sampled,
      orientation: new Cesium.VelocityOrientationProperty(sampled),
      ellipsoid: {
        radii: new Cesium.Cartesian3(8, 8, 3),
        material: Cesium.Color.WHITE,
      },
      path: {
        resolution: 1,
        material: Cesium.Color.ORANGE.withAlpha(0.6),
        width: 2,
      },
      label: {
        text: callsign,
        fillColor: Cesium.Color.ORANGE,
        showBackground: true,
        pixelOffset: new Cesium.Cartesian2(0, -25),
      },
    });

    const midpoint = Cesium.Cartesian3.midpoint(start3d, end3d, new Cesium.Cartesian3());
    viewer.entities.add({
      id: fovId,
      position: midpoint,
      cylinder: {
        length: altitude,
        topRadius: 0,
        bottomRadius: Math.tan(Cesium.Math.toRadians(fov / 2)) * altitude,
        material: Cesium.Color.RED.withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.RED,
      },
    });

    state.droneMission = {
      callsign,
      entityIds: [droneId, pathId, fovId],
    };

    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.shouldAnimate = true;

    addEvent(`Drone mission active: ${callsign}`);
    updateStats();
  });

  document.getElementById("dispatch-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const resource = form.get("resource");
    const task = form.get("task");

    if (!state.alerts.length) {
      addEvent("No active missing alerts available for dispatch", "danger");
      return;
    }

    const targetAlert = state.alerts.find((a) => a.id === state.selectedAlertId) || state.alerts[state.alerts.length - 1];
    const dispatch = {
      id: crypto.randomUUID(),
      resource,
      task,
      target: targetAlert.name,
    };

    state.dispatches.push(dispatch);
    const entry = document.createElement("div");
    entry.className = "list-item";
    entry.textContent = `${resource} → ${targetAlert.name}: ${task}`;
    refs.dispatchList.prepend(entry);

    const p = targetAlert.pos;
    const { lon, lat } = toCartographicStrings(p);
    addEvent(`Dispatch: ${resource} tasked to ${targetAlert.name} at ${lat}, ${lon}`);
    updateStats();
    e.target.reset();
  });

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const cartesian = viewer.scene.pickPosition(movement.position)
      || viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    if (state.clickMode === "path-start") state.pathDraft.start = cartesian;
    if (state.clickMode === "path-end") state.pathDraft.end = cartesian;
    if (state.clickMode === "drone-start") state.droneDraft.start = cartesian;
    if (state.clickMode === "drone-end") state.droneDraft.end = cartesian;

    if (state.clickMode?.startsWith("path")) updatePathStatus();
    if (state.clickMode?.startsWith("drone")) updateDroneStatus();

    if (state.clickMode) addEvent(`Map point selected for ${state.clickMode}`);
    state.clickMode = null;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  function animateThermalFeed() {
    const canvas = document.getElementById("thermal-feed");
    const ctx = canvas.getContext("2d");
    let phase = 0;

    setInterval(() => {
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4;
          const v = Math.floor(120 + 120 * Math.sin((x + phase) * 0.08) * Math.cos((y + phase) * 0.07));
          img.data[i] = Math.min(255, v + 80);
          img.data[i + 1] = Math.max(0, v - 40);
          img.data[i + 2] = 40;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      phase += 2;
    }, 300);
  }

  updateStats();
  updatePathStatus();
  updateDroneStatus();
  animateThermalFeed();
  addEvent("COP ready. Start by adding an alert or path.");
  setStatus("Cesium COP loaded.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
