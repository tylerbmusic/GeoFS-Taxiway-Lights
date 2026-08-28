// ==UserScript==
// @name         GeoFS Taxiway Lights
// @version      1.0
// @description  Adds taxiway lights using OSM data (https://www.openstreetmap.org/copyright)
// @author       GGamerGGuy
// @match        https://geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geo-fs.com
// @grant        none
// @downloadURL  https://github.com/tylerbmusic/GeoFS-Taxiway-Lights/raw/refs/heads/main/userscript.js
// @updateURL    https://github.com/tylerbmusic/GeoFS-Taxiway-Lights/raw/refs/heads/main/userscript.js
// ==/UserScript==
(function() {
    'use strict';
    let twLM; //The addon's GMenu instance
    window.twLLogging = false; //Used for debugging
    window.twLights = [];
    window.errs = 0;
    window.twLC = {
        oldChunks: [],
        newChunks: [],
        toAdd: [],
        toRemove: []
    };
    window.taxiwayList = [];
    window.taxiwaysReady = false;
    window.twRemoverInit = false;

    // Web Worker for optimized taxiway calculations
    const workerCode = `
        let taxiwayList = [];
        let twInterval = {g: ${localStorage.getItem("twLGDist") || 15}, b: ${localStorage.getItem("twLBDist") || 38}};
        let twWidth = ${localStorage.getItem("twLWidth") || 12};
        let doLogging = ${window.twLLogging};

        // Fast bounding-box check before performing trigonometrically heavy LLA calculations
        function fastDistCheck(lat1, lon1, lat2, lon2, maxMeters) {
            const latDiff = Math.abs(lat1 - lat2);
            const lonDiff = Math.abs(lon1 - lon2);
            const maxDeg = maxMeters * 0.00002; // ~1m = 0.000009 degrees lat
            if (latDiff > maxDeg || lonDiff > maxDeg) return false;

            return llaDistanceInMeters([lat1, lon1, 0], [lat2, lon2, 0]) < maxMeters;
        }

        function llaDistanceInMeters(pos1, pos2) {
            const lat1 = pos1[0] * Math.PI / 180;
            const lon1 = pos1[1] * Math.PI / 180;
            const lat2 = pos2[0] * Math.PI / 180;
            const lon2 = pos2[1] * Math.PI / 180;
            const dLat = lat2 - lat1;
            const dLon = lon2 - lon1;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
            return 6378137 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        function calculateBearing(lon1, lat1, lon2, lat2) {
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const lat1Rad = lat1 * Math.PI / 180;
            const lat2Rad = lat2 * Math.PI / 180;
            const y = Math.sin(dLon) * Math.cos(lat2Rad);
            const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
            return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }

        function calculateOffsetPoint(lon, lat, bearing, offsetDistance) {
            const R = 6378137;
            const bearingRad = (bearing + 90) * Math.PI / 180;
            const dLat = offsetDistance * Math.cos(bearingRad) / R;
            const dLon = offsetDistance * Math.sin(bearingRad) / (R * Math.cos(Math.PI * lat / 180));
            const degFactor = 180 / Math.PI;
            return {
                lonPlus: lon + dLon * degFactor,
                latPlus: lat + dLat * degFactor,
                lonMinus: lon - dLon * degFactor,
                latMinus: lat - dLat * degFactor
            };
        }

        function interpolatePoints(start, end, interval, extra = null) { //Extra allows for additional data to be attributed to each point (e.g., an ID)
            const [lon1, lat1] = start;
            const [lon2, lat2] = end;
            const distance = llaDistanceInMeters([lat1, lon1], [lat2, lon2]);
            const numPoints = Math.max(Math.floor(distance / interval), 1);
            const interpolated = [];
            for (let i = 0; i <= numPoints; i++) {
                const ratio = i / numPoints;
                if (extra) {
                    interpolated.push([
                        lon1 + (lon2 - lon1) * ratio,
                        lat1 + (lat2 - lat1) * ratio,
                        0,
                        extra
                    ]);
                } else {
                    interpolated.push([
                        lon1 + (lon2 - lon1) * ratio,
                        lat1 + (lat2 - lat1) * ratio,
                        0
                    ]);
                }
            }
            return interpolated;
        }

        const GRID_CELL_SIZE = 1E-5 * twWidth; // ~10m spatial cell size

        function getTaxiwayData(bounds) {
            const bds = bounds.split(", ").map(Number);
            const cbds = [bds[0] - 0.0002, bds[1] - 0.0002, bds[2] + 0.0002, bds[3] + 0.0002];

            const data = [];
            for (let mWay of taxiwayList) {
                if (!mWay.nodes || mWay.nodes.length <= 1) continue;
                for (let node of mWay.nodes) {
                    if (node[0] > cbds[1] && node[0] < cbds[3] && node[1] > cbds[0] && node[1] < cbds[2]) {
                        data.push(mWay);
                        break;
                    }
                }
            }

            const centerlinePoints = [];
            const denseCLPoints = []; //A much denser set of points that represents the taxiway centerline rather than the lights themselves
            for (let way of data) {
                const interval = twInterval.g;
                for (let i = 0; i < way.nodes.length - 1; i++) {
                    centerlinePoints.push(...interpolatePoints(way.nodes[i], way.nodes[i + 1], interval));
                    denseCLPoints.push(...interpolatePoints(way.nodes[i], way.nodes[i + 1], 3, way.id));
                }
            }

            // 1. CENTERLINE DEDUPLICATION & SPATIAL HASHING
            const clGrid = new Map();
            const clGrid2 = new Map();
            const uniqueCLSet = new Set();
            const uniqueCLSet2 = new Set();
            const filteredCenterline = [];

            for (let pt of centerlinePoints) {
                let keyStr = \`\${pt[0]},\${pt[1]}\`;
                if (uniqueCLSet.has(keyStr)) continue;

                let cellX = Math.floor(pt[1] / GRID_CELL_SIZE);
                let cellY = Math.floor(pt[0] / GRID_CELL_SIZE);
                let isClose = false;

                gridLoop:
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const neighbors = clGrid.get(\`\${cellX + dx},\${cellY + dy}\`);
                        if (neighbors) {
                            for (let nPt of neighbors) {
                                if (fastDistCheck(pt[1], pt[0], nPt[1], nPt[0], twInterval.g * 0.5)) {
                                    isClose = true;
                                    break gridLoop;
                                }
                            }
                        }
                    }
                }

                let mainKey = \`\${cellX},\${cellY}\`;
                if (!isClose) {
                    uniqueCLSet.add(keyStr);
                    filteredCenterline.push(pt);

                    if (!clGrid.has(mainKey)) clGrid.set(mainKey, []);
                    clGrid.get(mainKey).push(pt);
                }
            }
            for (let pt of denseCLPoints) {
                let keyStr = \`\${pt[0]},\${pt[1]}\`;
                if (uniqueCLSet2.has(keyStr)) continue;
                let cellX = Math.floor(pt[1] / GRID_CELL_SIZE);
                let cellY = Math.floor(pt[0] / GRID_CELL_SIZE);
                let mainKey = \`\${cellX},\${cellY}\`;
                uniqueCLSet2.add(keyStr);
                if (!clGrid2.has(mainKey)) clGrid2.set(mainKey, []);
                clGrid2.get(mainKey).push(pt);
            }

            // 2. GENERATE TAXIWAY EDGES & CLEAR AWAY FROM CENTERLINE
            const taxiwayEdges = [];
            for (let way of data) {
                const edgePoints = [];
                const interval = twInterval.b;

                for (let i = 0; i < way.nodes.length - 1; i++) {
                    const segmentPoints = interpolatePoints(way.nodes[i], way.nodes[i + 1], interval);
                    const bearing = calculateBearing(way.nodes[i][0], way.nodes[i][1], way.nodes[i + 1][0], way.nodes[i + 1][1]);
                    const offset = twWidth;

                    const interpolatedEdgePoints = segmentPoints.map(([lon, lat, alt]) => {
                        const offsetPoints = calculateOffsetPoint(lon, lat, bearing, offset);
                        let plus = [offsetPoints.lonPlus, offsetPoints.latPlus, alt];
                        let minus = [offsetPoints.lonMinus, offsetPoints.latMinus, alt];

                        const cellXPlus = Math.floor(offsetPoints.latPlus / GRID_CELL_SIZE);
                        const cellYPlus = Math.floor(offsetPoints.lonPlus / GRID_CELL_SIZE);
                        const cellXMinus = Math.floor(offsetPoints.latMinus / GRID_CELL_SIZE);
                        const cellYMinus = Math.floor(offsetPoints.lonMinus / GRID_CELL_SIZE);

                        // Check against centerline grid (80% clearance)
                        for (let dx = -3; dx <= 3; dx++) {
                            for (let dy = -3; dy <= 3; dy++) {
                                if (plus !== null) {
                                    const neighbors = clGrid2.get(\`\${cellXPlus + dx},\${cellYPlus + dy}\`);
                                    if (neighbors) {
                                        for (let nPt of neighbors) {
                                            if (fastDistCheck(offsetPoints.latPlus, offsetPoints.lonPlus, nPt[1], nPt[0], twWidth) && (way.id != nPt[3])) {
                                                plus = null;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (minus !== null) {
                                    const neighbors = clGrid2.get(\`\${cellXMinus + dx},\${cellYMinus + dy}\`);
                                    if (neighbors) {
                                        for (let nPt of neighbors) {
                                            if (fastDistCheck(offsetPoints.latMinus, offsetPoints.lonMinus, nPt[1], nPt[0], twWidth) && (way.id != nPt[3])) {
                                                minus = null;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return [plus || [0, 0, 0], minus || [0, 0, 0]];
                    });

                    edgePoints.push(...interpolatedEdgePoints);
                }
                taxiwayEdges.push(edgePoints);
            }

            // 3. O(N) SPATIAL DEDUPLICATION FOR EDGE POINTS (Range stuff part 2)
            const edgeGrid = new Map();
            const uniqueEdgeSet = new Set();

            for (let p = 0; p < taxiwayEdges.length; p++) {
                for (let q = 0; q < taxiwayEdges[p].length; q++) {
                    const pair = taxiwayEdges[p][q];

                    // Left (Plus) Edge Point Check
                    if (pair[0][0] !== 0 || pair[0][1] !== 0) {
                        const ptL = pair[0];
                        const keyL = \`\${ptL[0]},\${ptL[1]}\`;
                        const cellX = Math.floor(ptL[1] / GRID_CELL_SIZE);
                        const cellY = Math.floor(ptL[0] / GRID_CELL_SIZE);
                        let isDuplicateL = uniqueEdgeSet.has(keyL);

                        if (!isDuplicateL) {
                            gridCheckL:
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    const neighbors = edgeGrid.get(\`\${cellX + dx},\${cellY + dy}\`);
                                    if (neighbors) {
                                        for (let nPt of neighbors) {
                                            if (fastDistCheck(ptL[1], ptL[0], nPt[1], nPt[0], twInterval.b * 0.5)) {
                                                isDuplicateL = true;
                                                break gridCheckL;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (isDuplicateL) {
                            taxiwayEdges[p][q][0] = [0, 0, 0];
                        } else {
                            uniqueEdgeSet.add(keyL);
                            const mainKey = \`\${cellX},\${cellY}\`;
                            if (!edgeGrid.has(mainKey)) edgeGrid.set(mainKey, []);
                            edgeGrid.get(mainKey).push(ptL);
                        }
                    }

                    // Right (Minus) Edge Point Check
                    if (pair[1][0] !== 0 || pair[1][1] !== 0) {
                        const ptR = pair[1];
                        const keyR = \`\${ptR[0]},\${ptR[1]}\`;
                        const cellX = Math.floor(ptR[1] / GRID_CELL_SIZE);
                        const cellY = Math.floor(ptR[0] / GRID_CELL_SIZE);
                        let isDuplicateR = uniqueEdgeSet.has(keyR);

                        if (!isDuplicateR) {
                            gridCheckR:
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    const neighbors = edgeGrid.get(\`\${cellX + dx},\${cellY + dy}\`);
                                    if (neighbors) {
                                        for (let nPt of neighbors) {
                                            if (fastDistCheck(ptR[1], ptR[0], nPt[1], nPt[0], twInterval.b * 0.5)) {
                                                isDuplicateR = true;
                                                break gridCheckR;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (isDuplicateR) {
                            taxiwayEdges[p][q][1] = [0, 0, 0];
                        } else {
                            uniqueEdgeSet.add(keyR);
                            const mainKey = \`\${cellX},\${cellY}\`;
                            if (!edgeGrid.has(mainKey)) edgeGrid.set(mainKey, []);
                            edgeGrid.get(mainKey).push(ptR);
                        }
                    }
                }
            }

            // 4. BOUNDS FILTERING
            const clPR = filteredCenterline.filter(c =>
                c[0] > bds[1] && c[0] < bds[3] && c[1] > bds[0] && c[1] < bds[2]
            );

            for (let c = 0; c < taxiwayEdges.length; c++) {
                for (let d = 0; d < taxiwayEdges[c].length; d++) {
                    const te = taxiwayEdges[c][d];
                    if (te[0][0] !== 0 && !(te[0][0] > bds[1] && te[0][0] < bds[3] && te[0][1] > bds[0] && te[0][1] < bds[2])) {
                        taxiwayEdges[c][d][0] = [0, 0, 0];
                    }
                    if (te[1][0] !== 0 && !(te[1][0] > bds[1] && te[1][0] < bds[3] && te[1][1] > bds[0] && te[1][1] < bds[2])) {
                        taxiwayEdges[c][d][1] = [0, 0, 0];
                    }
                }
            }

            return [clPR, taxiwayEdges];
        }

        self.onmessage = function(e) {
            if (e.data.type === "init") {
                taxiwayList = e.data.taxiwayList;
                twInterval = {g: e.data.gInterval || 15, b: e.data.bInterval || 38};
                twWidth = e.data.width || 10;
                doLogging = e.data.log || ${window.twLLogging};
            } else if (e.data.type === "getTaxiwayData") {
                self.postMessage({
                    id: e.data.id,
                    data: getTaxiwayData(e.data.bounds)
                });
            }
        };
    `;

    const worker = new Worker(URL.createObjectURL(new Blob([workerCode], {type: "application/javascript"})));
    let workerID = 0;
    const workerCallbacks = {};

    worker.onmessage = function(e) {
        if (workerCallbacks[e.data.id]) {
            workerCallbacks[e.data.id](e.data.data);
            delete workerCallbacks[e.data.id];
        }
    };

    window.getTaxiwayDataWorker = function(bounds) {
        return new Promise(resolve => {
            const id = workerID++;
            workerCallbacks[id] = resolve;
            worker.postMessage({type: "getTaxiwayData", id: id, bounds: bounds});
        });
    };

    if (!window.gmenu || !window.GMenu) {
        (window.twLLogging) && console.log("Taxiway Lights getting GMenu");
        fetch('https://raw.githubusercontent.com/tylerbmusic/GeoFS-Addon-Menu/refs/heads/main/addonMenu.js')
            .then(response => response.text())
            .then(script => {eval(script);})
            .then(() => {setTimeout(afterGMenu, 100);});
    } else afterGMenu()

    async function afterGMenu() {
        twLM = new window.GMenu("Taxiway Lights", "twL");
        twLM.addItem("Only turn on lights at night: ", "NightOnly", "checkbox", 0, "true");
        twLM.addItem("Update Interval (seconds): ", "UpdateInterval", "number", 0, "5");
        twLM.addItem("Green/Yellow Light Size: ", "GSize", "number", 0, "0.5");
        twLM.addItem("Blue Light Size: ", "BSize", "number", 0, "0.5");
        twLM.addItem("Distance Between Green Lights (m): ", "GDist", "number", 0, "15");
        twLM.addItem("Distance Between Blue Lights (m): ", "BDist", "number", 0, "38");
        twLM.addItem("Taxiway width (m): ", "Width", "number", 0, "12");
        twLM.addItem("Prefer this addon to default lights: ", "Four", "checkbox", 0, "true");
        (window.twLLogging) && console.log("TwL Enabled? " + twLM.get("Enabled"));
        setTimeout(() => {window.updateLights();}, 100*twLM.get("UpdateInterval"));
        //Reset settings upon 1.0 update since a lot has visually changed
        if (!twLM.get("UpdatedToOne")) {
            twLM.set("UpdatedToOne", true);
            twLM.set("UpdateInterval", 15);
            twLM.set("GSize", 0.5);
            twLM.set("BSize", 0.5);
        }
        //Update notification
        async function checkForUpdates() {
            let NAME = "Taxiway-Lights";
            let SPACEDNAME = "Taxiway Lights";
            let VERSION = "1.0";
            let LSNAME = "twL";
            let URL = "https://github.com/tylerbmusic/GeoFS-Taxiway-Lights";
            let a = await fetch('https://tylerbmusic.github.io/versions.json?t=' + Date.now());
            let b = await a.text();
            let newversion = JSON.parse(b)[NAME];
            if (localStorage.getItem(LSNAME + "U" + VERSION) !== "true") {
                localStorage.setItem(LSNAME + "U" + VERSION, "true");
                await fetch(`https://track.tylerbialowas-bard.workers.dev?event=${LSNAME}v${VERSION}`, {method: "HEAD"});
            }
            if (newversion !== VERSION && localStorage.getItem(LSNAME + "StopU" + newversion) !== "true") {
                if (confirm(`A new update for ${SPACEDNAME} is available at ${URL}\nCurrent version: v${VERSION}; New version: v${newversion}\nPress "OK" open update URL in new tab, or "Cancel" to skip this update.`)) {
                    window.open(URL);
                    console.log("OPENING " + URL);
                } else {
                    localStorage.setItem(LSNAME + "StopU" + newversion, true);
                }
            }
        }
        checkForUpdates();
        //ANONYMOUS TRACKING VIA CLOUDFLARE (I will never sell your data.)
        //What's being tracked: For each script, how many hits (page loads) it's had in the last 24 hours, how many total hits in the last 30 days, and how many unique users there are.
        //Why it's being tracked: I am curious to know how many people are using my addons.
        //To see the data, go to https://tylerbmusic.github.io/stats in a web browser.

        if (true) {
            const SCRIPT_NAME = "Taxiway_Lights";

            let userId = localStorage.getItem("myScriptUserId");

            if (!userId) {
                userId = crypto.randomUUID();
                localStorage.setItem("myScriptUserId", userId);
            }
            try {
                const response = await fetch("https://track.tylerbialowas-bard.workers.dev", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        script: SCRIPT_NAME,
                        userId: userId
                    }),
                });

                if (response.ok) {
                    console.log("Analytics event sent successfully");
                }
            } catch (error) {
                console.error("Failed to track event:", error);
            }
        }

        //Fetch the taxiway databases and store them into a global array
        let urls = ["https://raw.githubusercontent.com/tylerbmusic/GPWS-files_geofs/refs/heads/main/taxiways1.json", "https://raw.githubusercontent.com/tylerbmusic/GPWS-files_geofs/refs/heads/main/taxiways2.json"];
        window.taxiwayList = [];
        for (let url of urls) {
            let f = await (await fetch(url)).text();
            let j = JSON.parse(f);
            for (let way of j) {
                window.taxiwayList.push(way);
            }
        }

        // Send taxiway data to worker
        worker.postMessage({type: "init", taxiwayList: window.taxiwayList, gInterval: twLM.get("GDist"), bInterval: twLM.get("BDist"), width: twLM.get("Width"), log: window.twLLogging});

        (window.twLLogging) && console.log("TWL finished loading taxiways.");
        window.taxiwaysReady = true;
    }

    function fpe(num) {
        return Number(num.toFixed(3));
    }

    window.updateLights = async function() {
        if (window.geofs.cautiousWithTerrain == false && twLM.get("Enabled") && (!window.geofs.airports || twLM.get("Four"))) {
            if (window.geofs.airports && window.geofs.airports.simple3DTileProvider) { //Remove the 4.0 default taxiway lights
                window.geofs.airports.simple3DTileProvider.destroy();
                window.geofs.airports.simple3DTileProvider = null;
                window.geofs.airports.taxiwayLightBillboardOptions.distanceDisplayCondition.far = 1E-5;
            }
            //Make the lights only visible at night, unless the setting is turned off
            if (window.$ && !window.twRemoverInit) {
                window.twRemoverInit = true;
                let f = () => {
                    for (let c in window.twLights) {
                        for (let l in window.twLights[c]) {
                            window.twLights[c][l].show = (window.geofs.isNight || !twLM.get("NightOnly"));
                        }
                    }
                }
                window.$("body").on("nightChange", f); //jQuery thing taken from geofs.js
            }

            let chunkSize = 0.02;
            let renderDist = 4;
            function chunkTick() {
                //Chunks creation
                let lla = window.geofs.aircraft.instance.llaLocation;
                window.twLC.newChunks = [];
                for (let v = -renderDist; v <= renderDist; v++) {
                    let arr = [];
                    for (let h = -renderDist; h <= renderDist; h++) {
                        arr.push({min: [fpe(Math.floor(lla[0]/chunkSize)*chunkSize + v*chunkSize), fpe(Math.floor(lla[1]/chunkSize)*chunkSize + h*chunkSize)], max: [fpe(Math.floor(lla[0]/chunkSize)*chunkSize + (v+1)*chunkSize), fpe(Math.floor(lla[1]/chunkSize)*chunkSize + (h+1)*chunkSize)]});
                    }
                    window.twLC.newChunks.push(arr);
                }
                //Testing new/old chunks
                if (JSON.stringify(window.twLC.newChunks) == JSON.stringify(window.twLC.oldChunks)) {
                    return;
                }
                window.twLC.toAdd = [];
                window.twLC.toRemove = [];
                //To Add
                for (let a = 0; a < window.twLC.newChunks.length; a++) {
                    for (let b = 0; b < window.twLC.newChunks.length; b++) {
                        if (JSON.stringify(window.twLC.oldChunks).indexOf(JSON.stringify(window.twLC.newChunks[a][b])) == -1) {
                            window.twLC.toAdd.push([a,b]);
                        }
                        if ((window.twLC.oldChunks[a] && window.twLC.oldChunks[a][b]) && JSON.stringify(window.twLC.newChunks).indexOf(JSON.stringify(window.twLC.oldChunks[a][b])) == -1) {
                            window.twLC.toRemove.push([a,b]);
                        }
                    }
                }
                for (let f in window.twLC.toRemove) {
                    let bds = window.twLC.oldChunks[window.twLC.toRemove[f][0]][window.twLC.toRemove[f][1]];
                    let bound = `${fpe(bds.min[0])}, ${fpe(bds.min[1])}, ${fpe(bds.max[0])}, ${fpe(bds.max[1])}`;
                    for (let l in window.twLights[bound]) {
                        window.geofs.api.viewer.entities.remove(window.twLights[bound][l]);
                    }
                    delete window.twLights[bound];
                }
                function addTheStuff(e) {
                    if (e == window.twLC.toAdd.length) {
                        return;
                    }
                    (window.twLLogging) && console.log("adding " + e);
                    let bds = window.twLC.newChunks[window.twLC.toAdd[e][0]][window.twLC.toAdd[e][1]];
                    let bound = `${fpe(bds.min[0])}, ${fpe(bds.min[1])}, ${fpe(bds.max[0])}, ${fpe(bds.max[1])}`;
                    if (window.twLLogging && e == 45) {
                        console.log([window.twLC.newChunks, window.twLC.oldChunks]);
                    }
                    window.getTwD(bound, bound);
                    setTimeout(() => {addTheStuff(e+1)},300);
                }
                addTheStuff(0);
                window.twLC.oldChunks = window.twLC.newChunks;
            }
            chunkTick();
        } else if (!twLM.get("Enabled") || (window.geofs.airports && !twLM.get("Four"))) {
            window.lastBounds = "";
        }
        setTimeout(() => {window.updateLights();}, 1000*twLM.get("UpdateInterval"));
    }

    async function getTaxiwayData(bounds) {
        window.twLLogging && console.log("Getting Taxiway Data for bounds " + bounds);
        return await window.getTaxiwayDataWorker(bounds);
    }

    window.twLHeights = async function() {
        window.twLLogging && console.log("Resetting TWL Heights");
        for (let b in window.twLights) {
            for (let lt in window.twLights[b]) {
                let light = window.twLights[b][lt];
                let apos = window.geofs.getGroundAltitude(JSON.parse(light.id)).location;
                light.position = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2] + Number(light.name));
            }
        }
    }

    window.getTwD = async function(bounds, id) {
        let gtd = await getTaxiwayData(bounds);
        if (!gtd) {
            return;
        }
        let centerline = gtd[0];
        let edges = gtd[1];
        //EDGES
        if (edges && edges.length && edges.length > 0) {
            edges.forEach(edge => {
                edge.forEach(([plus, minus]) => {
                    [plus, minus].forEach(epos => {
                        if (epos && (epos[0] || epos[1]) && !checkProximityToRunway(epos, 40)) {
                            const apos = window.geofs.getGroundAltitude([epos[1], epos[0], epos[2]]).location;
                            const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2] + 1); //Convert to Cartesian3 and set height AGL to 1m
                            if (!window.twLights[id]) {
                                window.twLights[id] = [];
                            }
                            window.twLights[id].push(
                                window.geofs.api.viewer.entities.add({
                                    position: pos,
                                    id: JSON.stringify(apos),
                                    name: "1",
                                    show: (window.geofs.isNight || !twLM.get("NightOnly")),
                                    billboard: {
                                        sizeInMeters: false,
                                        //heightReference: window.Cesium.HeightReference.RELATIVE_TO_GROUND,
                                        image: "https://tylerbmusic.github.io/GPWS-files_geofs/bluelight.png",
                                        scale: twLM.get("BSize") * (1 / window.geofs.api.renderingSettings.resolutionScale),
                                        scaleByDistance: {
                                            "near": 1,
                                            "nearValue": 0.5,
                                            "far": 300,
                                            "farValue": 0.05
                                        },
                                        translucencyByDistance: new window.Cesium.NearFarScalar(10e2, 1.0, 80e2, 0.01)
                                    },
                                })
                            );
                        }
                    });
                });
            });
        }
        //CENTERLINE
        var z = 0;
        if (centerline && centerline.length && centerline.length > 0) {
            centerline.forEach(epos => {
                if (epos && (epos[0] || epos[1])) {
                    z++;
                    const apos = window.geofs.getGroundAltitude([epos[1], epos[0], epos[2]]).location;
                    const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2] + 0.2); //Convert to Cartesian3 and set height AGL to 0.2m
                    const isNearRunway = checkProximityToRunway(epos, 100);
                    const lightImage = (z%2 == 0 && isNearRunway) ? "https://tylerbmusic.github.io/GPWS-files_geofs/yellowlight.png" : "https://tylerbmusic.github.io/GPWS-files_geofs/greenlight.png";
                    if (!window.twLights[id]) {
                        window.twLights[id] = [];
                    }
                    window.twLights[id].push(
                        window.geofs.api.viewer.entities.add({
                            position: pos,
                            id: JSON.stringify(apos),
                            name: "0.2",
                            show: (window.geofs.isNight || !twLM.get("NightOnly")),
                            billboard: {
                                sizeInMeters: false,
                                //heightReference: window.Cesium.HeightReference.RELATIVE_TO_GROUND,
                                eyeOffset: new window.Cesium.Cartesian3(0,0,-4),
                                image: lightImage,
                                scale: twLM.get("GSize") * (1 / window.geofs.api.renderingSettings.resolutionScale),
                                scaleByDistance: {
                                    "near": 1,
                                    "nearValue": 0.5,
                                    "far": 300,
                                    "farValue": 0.05
                                },
                                translucencyByDistance: new window.Cesium.NearFarScalar(100, 1.0, 40e2, 0.01)
                            },
                        })
                    );
                }
            });
        }
    };
    function interpolatePoints(start, end, interval) {
        const [lon1, lat1] = start;
        const [lon2, lat2] = end;
        const distance = window.geofs.utils.llaDistanceInMeters([lat1, lon1], [lat2, lon2]);
        const numPoints = Math.max(Math.floor(distance / interval), 1);
        const interpolated = [];
        for (let i = 0; i <= numPoints; i++) {
            const ratio = i / numPoints;
            const lon = lon1 + (lon2 - lon1) * ratio;
            const lat = lat1 + (lat2 - lat1) * ratio;
            interpolated.push([lon, lat, 0]);
        }
        return interpolated;
    }

    function checkProximityToRunway(pos, dist) {
        // Retrieve and cache nearest runway if not already cached
        if (!window.runwayThresholds || !window.rwThreshLastPos || window.geofs.utils.llaDistanceInMeters(window.rwThreshLastPos, [pos[1], pos[0]]) > 500) {
            window.runwayThresholds = [];
            window.rwThreshLastPos = [pos[1], pos[0]];
            for (var i in window.geofs.runways.nearRunways) {
                const nearestRunway = window.geofs.runways.nearRunways[i];
                const l0 = nearestRunway.threshold1;
                const l1 = nearestRunway.threshold2;
                window.runwayThresholds.push(interpolatePoints([l0[1], l0[0]], [l1[1], l1[0]], 5));
            }
        }

        const distSquared = (dist / 111000) ** 2;
        const posLon = pos[0];
        const posLat = pos[1];

        for (var v in window.runwayThresholds) {
            if (window.runwayThresholds[v].some(([lon, lat]) => {
                const deltaLon = lon - posLon;
                const deltaLat = lat - posLat;
                return deltaLon ** 2 + deltaLat ** 2 < distSquared;
            })) {
                return true;
            }
        }

        return false;
    }
})();
