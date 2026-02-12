// ==UserScript==
// @name         GeoFS Taxiway Lights
// @version      0.8
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
    window.twLights = [];
    window.errs = 0;
    window.twLC = {
        oldChunks: [],
        newChunks: [],
        toAdd: [],
        toRemove: []
    };
    /*if (localStorage.getItem("twLEnabled") == null) {
        localStorage.setItem("twLEnabled", 'true');
    }
    if (localStorage.getItem("twLRenderDist") == null) {
        localStorage.setItem("twLRenderDist", '0.05');
    }
    if (localStorage.getItem("twLUpdateInterval") == null) {
        localStorage.setItem("twLUpdateInterval", "5");
    }
    if (localStorage.getItem("twLGSize") == null) {
        localStorage.setItem("twLGSize", "0.05");
    }
    if (localStorage.getItem("twLBSize") == null) {
        localStorage.setItem('twLBSize', "0.07");
    }*/
    if (!window.gmenu || !window.GMenu) {
        console.log("Taxiway Lights getting GMenu");
        fetch('https://raw.githubusercontent.com/tylerbmusic/GeoFS-Addon-Menu/refs/heads/main/addonMenu.js')
            .then(response => response.text())
            .then(script => {eval(script);})
            .then(() => {setTimeout(afterGMenu, 100);});
    } else afterGMenu()
    async function afterGMenu() {
        const twLM = new window.GMenu("Taxiway Lights", "twL");
        twLM.addItem("Render distance (degrees): ", "RenderDist", "number", 0, '0.05');
        twLM.addItem("Update Interval (seconds): ", "UpdateInterval", "number", 0, '5');
        twLM.addItem("Green/Yellow Light Size: ", "GSize", "number", 0, "0.05");
        twLM.addItem("Blue Light Size: ", "BSize", "number", 0, "0.07");
        console.log("TwL Enabled? " + localStorage.getItem("twLEnabled"));
        setTimeout(() => {window.updateLights();}, 100*Number(localStorage.getItem("twLUpdateInterval")));
        //Update notification
        async function checkForUpdates() {
            let NAME = "Taxiway-Lights";
            let SPACEDNAME = "Taxiway Lights";
            let VERSION = "0.8";
            let URL = "https://github.com/tylerbmusic/GeoFS-Taxiway-Lights";
            let a = await fetch('https://tylerbmusic.github.io/versions.json')
            let b = await a.text();
            let newversion = JSON.parse(b)[NAME];
            if (newversion !== VERSION && localStorage.getItem("twLStopU" + newversion) !== "true") {
                if (confirm(`A new update for ${SPACEDNAME} is available at ${URL}\nCurrent version: v${VERSION}; New version: v${newversion}\nPress "OK" to copy URL, or "Cancel" to skip this update.`)) {
                    await navigator.clipboard.writeText(URL);
                    console.log("COPIED " + URL + " TO CLIPBOARD");
                } else {
                    localStorage.setItem("twLStopU" + newversion, true);
                }
            }
        }
        checkForUpdates();
        //ANONYMOUS TRACKING VIA CLOUDFLARE (I will never sell your data.)
        //What's being tracked: For each script, how many hits (page loads) it's had in the last 24 hours, how many total hits in the last 30 days, and how many unique users there are.
        //Why it's being tracked: I am curious to know how many people are using my addons.
        //To see the data, go to https://track.tylerbialowas-bard.workers.dev in a web browser.

        if (true) { //To opt out of anonymous tracking, change the word "true" in this line to "false".
            const SCRIPT_NAME = "Taxiway_Lights";

            // Generate persistent ID
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
    }
})();
function fpe(num) {
    return Number(num.toFixed(3));
}

window.updateLights = async function() {
    if (window.geofs.cautiousWithTerrain == false && (localStorage.getItem("twLEnabled") == 'true')) { //timeRatio is basically how bright the terrain should be--at noon it's 0, at midnight it's 1
        var renderDistance = Number(localStorage.getItem("twLRenderDist")); //Render distance, in degrees.
        var l0 = Math.floor(window.geofs.aircraft.instance.llaLocation[0]/renderDistance)*renderDistance;
        var l1 = Math.floor(window.geofs.aircraft.instance.llaLocation[1]/renderDistance)*renderDistance;
        var bounds = (l0) + ", " + (l1) + ", " + (l0+renderDistance) + ", " + (l1+renderDistance);
        let chunkSize = 0.04;
        let renderDist = 3;
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
                    if (JSON.stringify(window.twLC.oldChunks).indexOf(JSON.stringify(window.twLC.newChunks[a][b])) == -1) { //If it hadn't existed before, it's new
                        window.twLC.toAdd.push([a,b]);
                    }
                    if ((window.twLC.oldChunks[a] && window.twLC.oldChunks[a][b]) && JSON.stringify(window.twLC.newChunks).indexOf(JSON.stringify(window.twLC.oldChunks[a][b])) == -1) { //If it doesn't exist anymore, it's old
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
                if (e == window.twLC.length) {
                    return;
                }
                console.log("adding " + e);
                let bds = window.twLC.newChunks[window.twLC.toAdd[e][0]][window.twLC.toAdd[e][1]]; //bounds, no formatting
                let bound = `${fpe(bds.min[0])}, ${fpe(bds.min[1])}, ${fpe(bds.max[0])}, ${fpe(bds.max[1])}`;
                if (e == 45) {
                    console.log([window.twLC.newChunks, window.twLC.oldChunks]);
                }
                window.getTwD(bound, bound); //getTaxiwayData
                setTimeout(() => {window.getTwDE(bound, bound)}, 150); //getTaxiwayDataEdgeless
                setTimeout(() => {addTheStuff(e+1)},300); //Private.coffee doesn't want more than 10 requests per second; I added this to give some time between requests.
            }
            addTheStuff(0);
            window.twLC.oldChunks = window.twLC.newChunks;
        }
        chunkTick();
    } else if ((localStorage.getItem("twLEnabled") != 'true')) {
        window.lastBounds = "";
        //for (let i in window.twLights) {
        //    window.geofs.api.viewer.entities.remove(window.twLights[i]);
        //}
        //window.twLights = [];
        //console.log("It's either daytime or the taxiway lights aren't enabled, lights are off");
    }
    setTimeout(() => {window.updateLights();}, 1000*Number(localStorage.getItem("twLUpdateInterval")));
}

function calculateBearing(lon1, lat1, lon2, lat2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
          Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360 degrees
}

// Function to calculate the offset points based on the bearing.
function calculateOffsetPoint(lon, lat, bearing, offsetDistance) {
    const R = 6378137; // Earth's radius in meters

    // Convert bearing to radians
    const bearingRad = (bearing + 90) * Math.PI / 180; // +90 to make it perpendicular

    // Calculate offset in radians
    const dLat = offsetDistance * Math.cos(bearingRad) / R;
    const dLon = offsetDistance * Math.sin(bearingRad) / (R * Math.cos(Math.PI * lat / 180));

    return {
        lonPlus: lon + dLon * 180 / Math.PI,
        latPlus: lat + dLat * 180 / Math.PI,
        lonMinus: lon - dLon * 180 / Math.PI,
        latMinus: lat - dLat * 180 / Math.PI
    };
}

function interpolatePoints(start, end, interval) {
    const [lon1, lat1] = start;
    const [lon2, lat2] = end;

    const distance = Math.sqrt(
        Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2)
    );

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

async function getTaxiwayData(bounds) {
    const overpassUrl = 'https://overpass.private.coffee/api/interpreter';
    const query = `
        [out:json];
        (
            way["aeroway"="taxiway"]({{bbox}})[ref];
        );
        out body;
        >;
        out skel qt;
    `;
    const bbox = bounds;

    try {
        const response = await fetch(overpassUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Project-Name": "GeoFS Taxiway Lights",
                "From": "https://tylerbmusic.github.io/contact"
            },
            body: "data=" + encodeURIComponent(query.replace('{{bbox}}', bbox))
        });
        const data = await response.json();

        const taxiwayEdges = [];
        const nodes = {};

        data.elements.forEach(element => {
            if (element.type === 'node') {
                nodes[element.id] = element;
            }
        });

        data.elements.forEach(element => {
            if (element.type === 'way') {
                const wayNodes = element.nodes.map(nodeId => {
                    const node = nodes[nodeId];
                    if (node) {
                        return [node.lon, node.lat, 0];
                    }
                }).filter(Boolean);

                if (wayNodes.length > 1) {
                    const edgePoints = [];
                    const interval = 0.0002 + ((Math.random()-0.5)*0.00005); // Adjust for desired spacing

                    for (let i = 0; i < wayNodes.length - 1; i++) {
                        const segmentPoints = interpolatePoints(wayNodes[i], wayNodes[i + 1], interval);
                        const bearing = calculateBearing(
                            wayNodes[i][0], wayNodes[i][1],
                            wayNodes[i + 1][0], wayNodes[i + 1][1]
                        );

                        // Calculate edge points for each interpolated point
                        const offset = 10; // 10 meters from centerline
                        const interpolatedEdgePoints = segmentPoints.map(([lon, lat, alt]) => {
                            const offsetPoints = calculateOffsetPoint(lon, lat, bearing, offset);
                            return [
                                [offsetPoints.lonPlus, offsetPoints.latPlus, alt],
                                [offsetPoints.lonMinus, offsetPoints.latMinus, alt]
                            ];
                        });

                        edgePoints.push(...interpolatedEdgePoints);
                    }

                    taxiwayEdges.push(edgePoints);
                }
            }
        });

        return taxiwayEdges;
    } catch (error) {
        console.error('Error fetching taxiway data:', error);
    }
}

///
async function getTaxiwayDataEdgeless(bounds) {
    const overpassUrl = 'https://overpass.private.coffee/api/interpreter';
    const query = `
        [out:json];
        (
            way["aeroway"="taxiway"]({{bbox}});
        );
        out body;
        >;
        out skel qt;
    `;
    const bbox = bounds;

    try {
        const response = await fetch(overpassUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Project-Name": "GeoFS Taxiway Lights",
                "From": "https://tylerbmusic.github.io/contact"
            },
            body: "data=" + encodeURIComponent(query.replace('{{bbox}}', bbox))
        });
        const data = await response.json();

        const centerlinePoints = [];
        const nodes = {};

        data.elements.forEach(element => {
            if (element.type === 'node') {
                nodes[element.id] = element;
            }
        });

        data.elements.forEach(element => {
            if (element.type === 'way') {
                const wayNodes = element.nodes.map(nodeId => {
                    const node = nodes[nodeId];
                    if (node) {
                        return [node.lon, node.lat, 0];
                    }
                }).filter(Boolean);

                if (wayNodes.length > 1) {
                    const interval = 0.00007 + ((Math.random()-0.5)*0.00002); // Semi-random spacing

                    for (let i = 0; i < wayNodes.length - 1; i++) {
                        const segmentPoints = interpolatePoints(wayNodes[i], wayNodes[i + 1], interval);
                        centerlinePoints.push(...segmentPoints);
                    }
                }
            }
        });

        return centerlinePoints;
    } catch (error) {
        console.error('Error fetching taxiway data:', error);
    }
}
window.getTwD = async function(bounds, id) {
    getTaxiwayData(bounds).then(edges => {
        if (edges && edges.length && edges.length > 0) {
            edges.forEach(edge => {
                edge.forEach(([plus, minus]) => {
                    [plus, minus].forEach(epos => {
                        const apos = window.geofs.getGroundAltitude([epos[1], epos[0], epos[2]]).location;
                        apos[2] += 0.3556; //Offset 14 inches from the ground
                        const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2]);
                        if (pos[2] < 0) {
                            window.errs++;
                            pos[2] = 0 - pos[2];
                        }
                        if (!window.twLights[id]) {
                            window.twLights[id] = [];
                        }
                        window.twLights[id].push(
                            window.geofs.api.viewer.entities.add({
                                position: pos,
                                billboard: {
                                    image: "https://tylerbmusic.github.io/GPWS-files_geofs/bluelight.png",
                                    scale: Number(localStorage.getItem("twLBSize")) * (1 / window.geofs.api.renderingSettings.resolutionScale),
                                    scaleByDistance: { //May or may not work
                                        "near": 1,
                                        "nearValue": 0.5,
                                        "far": 1500,
                                        "farValue": 0.2
                                    },
                                    translucencyByDistance: new window.Cesium.NearFarScalar(10, 0.6, 10e3, 0.1)
                                },
                            }));
                    });
                });
            });
        }
    });
};

///
function checkProximityToRunway(pos) {
    // Retrieve and cache nearest runway if not already cached
    if (!window.runwayThresholds) {
        window.runwayThresholds = [];
        for (var i in window.geofs.runways.nearRunways) {
            const nearestRunway = window.geofs.runways.nearRunways[i];
            const l0 = nearestRunway.threshold1;
            const l1 = nearestRunway.threshold2;
            window.runwayThresholds.push(interpolatePoints([l0[1], l0[0]], [l1[1], l1[0]], 5 / 111000));
        }
    }

    const distSquared = (40 / 111000) ** 2; // Square distance to avoid sqrt calculations
    const posLon = pos[0];
    const posLat = pos[1];

    // Check if any point along the runway centerline is within the set proximity distance
    for (var v in window.runwayThresholds) {
        if (window.runwayThresholds[v].some(([lon, lat]) => {
            const deltaLon = lon - posLon;
            const deltaLat = lat - posLat;
            return deltaLon ** 2 + deltaLat ** 2 < distSquared;
        })) {
            return true; // Return true if any point is within proximity
        }
    }
    return false; // Return false if no points were close enough
}
///

window.getTwDE = async function(bounds, id) {
    getTaxiwayDataEdgeless(bounds).then(centerline => {
        var z = 0;
        if (centerline && centerline.length && centerline.length > 0) {
            centerline.forEach(epos => {
                z++;
                const apos = window.geofs.getGroundAltitude([epos[1], epos[0], epos[2]]).location;
                apos[2] += 0.3556; //Offset 14 inches from the ground
                const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2]);

                // Calculate distance to runway and set light color accordingly
                const isNearRunway = checkProximityToRunway(epos); // Calculate proximity
                const lightImage = (z%2 == 0 && isNearRunway) ?
                      "https://tylerbmusic.github.io/GPWS-files_geofs/yellowlight.png" :
                "https://tylerbmusic.github.io/GPWS-files_geofs/greenlight.png";

                if (pos[2] < 0) {
                    window.errs++;
                    pos[2] = 0 - pos[2];
                }
                if (!window.twLights[id]) {
                    window.twLights[id] = [];
                }
                window.twLights[id].push(
                    window.geofs.api.viewer.entities.add({
                        position: pos,
                        billboard: {
                            image: lightImage,
                            scale: Number(localStorage.getItem("twLGSize")) * (1 / window.geofs.api.renderingSettings.resolutionScale),
                            scaleByDistance: {
                                "near": 1,
                                "nearValue": 0.5,
                                "far": 2000,
                                "farValue": 0.2
                            },
                            translucencyByDistance: new window.Cesium.NearFarScalar(10, 0.6, 10e3, 0.1)
                        },
                    })
                );
            });
        }
    });
};
