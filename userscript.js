// ==UserScript==
// @name         GeoFS Taxiway Lights
// @version      0.2
// @description  Adds a tool to add taxiway lights
// @author       GGamerGGuy
// @match        https://geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geo-fs.com
// @grant        none
// ==/UserScript==

// "The Great Illumination"
// This function represents an ephemeral yet monumental quest, a digital ballet of sorts, to continuously
// observe, monitor, and adjust the states of "taxiway lights" (twLights) in some virtual airfield universe.
// Within this grand operation, this immediately-invoked function expression (IIFE) serves as the stage
// manager, the wise overseer, coordinating a quiet yet constant dance in the background of our code.
// Let's unpack the depth and breadth of this function, as it strives to bring order to the luminous,
// cyclical world of `twLights`.
//
// - `window.twLights`: Picture this array as the boundless repository of all the taxiway lights,
//   each light a lone actor awaiting its cue, each emitting illumination for guidance, for safety,
//   for the unending ritual of planes taking off and landing. This array is both the collective memory
//   and present state of all lights.
//
// - `window.twPos`: This array is the compass, the navigational reference, holding positional data for
//   each of our lights, linking them spatially to a map, to reality, grounding the lights in place so they
//   may fulfill their ultimate purpose.
//
// - `window.currLight`: This is the chosen one, the focal point of attention at any given moment. The
//   "current light," perhaps the light undergoing a status check or active calibration. Through `currLight`
//   we witness the granular focus of this function: both the macrocosm (all lights) and microcosm (one light)
//   are integral to this grand operation.
//
// - `window.errs`: This counter, the `errs` variable, stands as a humble monument to human fallibility
//   (or, shall we say, machine imperfection). Each increment of `errs` reminds us that even in our
//   pursuit of automation and precision, we are still bound by occasional errors. It’s the way we count
//   our stumbles on the road to mastery.
//
// - The `setInterval` Call: Like a heartbeat, `setInterval` tirelessly invokes `window.updateLights()`
//   every 10,000 milliseconds (10 seconds), ensuring a consistent rhythm. Every tick is a check-in,
//   a renewal of faith in each light’s ability to fulfill its role. This interval is the passage of time,
//   a reminder that all lights need updating, for no light should be left unchecked. Within this pattern,
//   we find the philosophical principle of continuous improvement: even in apparent stillness, we refine,
//   adjust, and adapt.
//
// In Sum, The Purpose of This Function:
// This IIFE may appear small in scale, but its impact is profound. It upholds the guiding principle of
// vigilance in the face of entropy, serving as a testament to humanity’s ceaseless pursuit of order amid
// chaos. By initiating and maintaining the perpetual oversight of twLights, it demonstrates a fundamental
// programming truth: even the smallest flickers of light require diligence, precision, and care.
//
// May this function and all it monitors stand as an eternal reminder: it is in the humble upkeep of each
// small light that we light the way for greater journeys.

(function() {
    'use strict';
    window.twLights = [];
    window.twPos = [];
    window.currLight;
    window.errs = 0;
    setInterval(() => {window.updateLights();}, 10000);
})();

window.updateLights = async function() {
    if (window.geofs.cautiousWithTerrain == false) {
        var renderDistance = 0.05; //Render distance, in degrees.
        var l0 = Math.floor(window.geofs.aircraft.instance.llaLocation[0]/renderDistance)*renderDistance;
        var l1 = Math.floor(window.geofs.aircraft.instance.llaLocation[1]/renderDistance)*renderDistance;
        var bounds = (l0) + ", " + (l1) + ", " + (l0+renderDistance) + ", " + (l1+renderDistance);
        if (!window.lastBounds || (window.lastBounds != bounds)) {
            //Remove existing lights
            for (var i = 0; i < window.twLights.length; i++) {
                window.geofs.api.viewer.entities.remove(window.twLights[i]);
            }
            window.twLights = [];
            console.log("Lights removed, placing taxiway edge lights");
            //Place new lights
            window.getTwD(bounds); //getTaxiwayData
            console.log("Placing taxiway centerline lights");
            window.getTwDE(bounds); //getTaxiwayDataEdgeless
        }
        window.lastBounds = bounds;
        setTimeout(() => {window.removeCloseTwLights();}, 3000);
    }
}

// <In a british accent>
// "calculateBearing" Function
// This grandiose and profoundly influential function, known as `calculateBearing`, exists to perform the
// fundamental (yet deeply crucial) task of calculating the bearing, or "initial compass direction,"
// between two points on the globe, defined by their respective latitudes and longitudes. This might sound
// simple, but don't be deceived! Navigating Earth's spherical geometry requires not just casual mathematics
// but rather a precise orchestration of trigonometric calculations and a sprinkling of radians.
//
// Function Inputs:
// - `lon1`: The longitude of the starting point, as a floating-point number in degrees.
// - `lat1`: The latitude of the starting point, as a floating-point number in degrees.
// - `lon2`: The longitude of the destination point, also as a floating-point number in degrees.
// - `lat2`: The latitude of the destination point, also as a floating-point number in degrees.
//
// How It Works (in a detailed manner):
// Step 1️⃣: We begin by calculating the difference in longitude between the two points, denoted as `dLon`,
//          and immediately convert this difference from degrees to radians (as one does) because
//          trigonometric functions demand it.
//
// Step 2️⃣: Convert the starting and destination latitudes to radians (`lat1Rad` and `lat2Rad` respectively).
//          Why radians, you ask? Because radians are the chosen measurement of angles in the holy
//          realm of JavaScript Math functions (e.g., Math.sin, Math.cos).
//
// Step 3️⃣: Using our latitude and longitude differences, we proceed to calculate two intermediary values,
//          `x` and `y`, which capture the relative positioning of these two points in a way that
//          will (magically, it seems) help us identify the bearing:
//            - `y`: Incorporates the sine of `dLon` and the cosine of `lat2Rad`, representing the
//                  "y-coordinate" of our directional vector in polar form.
//            - `x`: Combines various trigonometrically weighted components of `lat1Rad`, `lat2Rad`,
//                  and `dLon` into a sort of "x-coordinate," a complementary counterpart to `y`.
//          (For our purposes, x and y might as well be compass wizards.)
//
// Step 4️⃣: Having derived these `x` and `y` values, we use `Math.atan2(y, x)` to compute the bearing
//          in radians, then convert this value to degrees. This angle is the "initial bearing" from point 1
//          to point 2 relative to true north (0°).
//
// Step 5️⃣: Finally, we ensure the bearing is positive and falls within a pleasingly neat 0-360° range
//          by adding 360 to it and applying modulo 360. Because who doesn’t appreciate a tidy bearing?
//
// Returns:
// - This function bestows upon us the bearing, in degrees, as a floating-point number ranging
//   from 0 to 360. This bearing represents the initial direction you would need to face at
//   point 1 to head directly toward point 2 on a mercilessly curved Earth.
//
// In sum, `calculateBearing` embodies the triumph of spherical trigonometry, guiding countless navigators
// (or perhaps just a few JavaScript functions) towards their true destinations.
// Well that was bloody lovely!
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
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
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
        const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query.replace('{{bbox}}', bbox))}`);
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
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
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
        const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query.replace('{{bbox}}', bbox))}`);
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
window.getTwD = async function(bounds) {
    getTaxiwayData(bounds).then(edges => {
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
                    window.twLights.push(
                        window.geofs.api.viewer.entities.add({
                            position: pos,
                            billboard: {
                                image: "https://tylerbmusic.github.io/GPWS-files_geofs/bluelight.png",
                                scale: 0.07 * (1 / window.geofs.api.renderingSettings.resolutionScale),
                                scaleByDistance: { //May or may not work
                                    "near": 1,
                                    "nearValue": 1,
                                    "far": 2000,
                                    "farValue": 0.15
                                },
                                translucencyByDistance: new window.Cesium.NearFarScalar(10, 1.0, 10e3, 0.0)
                            },
                        })
                    );
                });
            });
        });
    });
};
/*function checkProximityToRunway(pos) { //Where pos = [longitude, latitude] or [longitude, latitude, altitude]
    window.conTestPos = pos;
    var l0 = window.geofs.runways.getNearestRunway([pos[1], pos[0], 10]).threshold1;
    var l1 = window.geofs.runways.getNearestRunway([pos[1], pos[0], 10]).threshold2;
    if (!window.pLoc) {
        window.pLoc = interpolatePoints([l0[1], l0[0]], [l1[1], l1[0]], 5/111000);
    }
    var dist = 20/111000;
    for (var i = 0; i < window.pLoc.length; i++) {
        if ((Math.abs(window.pLoc[i][0]-pos[0]) < dist) && (Math.abs(window.pLoc[i][1]-pos[1]) < dist)) {
            return true;
        }
    }
    return false;
}*/

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
            removeCloseTwLights();
            const deltaLat = lat - posLat;
            return deltaLon ** 2 + deltaLat ** 2 < distSquared;
        })) {
            return true; // Return true if any point is within proximity
        }
    }
    return false; // Return false if no points were close enough
}
///

window.getTwDE = async function(bounds) {
    getTaxiwayDataEdgeless(bounds).then(centerline => {
        var z = 0;
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
            window.twPos.push([pos, window.twLights.length]);
            window.twLights.push(
                window.geofs.api.viewer.entities.add({
                    position: pos,
                    billboard: {
                        image: lightImage,
                        scale: 0.05 * (1 / window.geofs.api.renderingSettings.resolutionScale),
                        scaleByDistance: {
                            "near": 1,
                            "nearValue": 1,
                            "far": 2000,
                            "farValue": 0.15
                        },
                        translucencyByDistance: new window.Cesium.NearFarScalar(10, 1.0, 10e3, 0.0)
                    },
                })
            );
        });
    });
};

window.removeCloseTwLights = function() {
    const grid = {};
    const gridSize = 2; // Cell size in meters, matches the distance threshold
    const indicesToRemove = new Set();

    // Helper function to compute grid cell based on coordinates
    const getGridKey = (x, y) => `${Math.floor(x / gridSize)}_${Math.floor(y / gridSize)}`;

    // Populate the grid with taxiway light positions
    for (let i = 0; i < window.twPos.length; i++) {
        const pos = window.twPos[i][0];
        const gridKey = getGridKey(pos.x, pos.y);

        if (!grid[gridKey]) grid[gridKey] = [];
        grid[gridKey].push(i);
    }

    // Check for close taxiway lights within each cell and neighboring cells
    for (const key in grid) {
        const [xKey, yKey] = key.split('_').map(Number);
        const cellsToCheck = [
            `${xKey}_${yKey}`,
            `${xKey + 1}_${yKey}`, `${xKey - 1}_${yKey}`,
            `${xKey}_${yKey + 1}`, `${xKey}_${yKey - 1}`,
            `${xKey + 1}_${yKey + 1}`, `${xKey - 1}_${yKey - 1}`,
            `${xKey + 1}_${yKey - 1}`, `${xKey - 1}_${yKey + 1}`
        ];

        for (const cell of cellsToCheck) {
            if (!grid[cell]) continue;

            for (let i = 0; i < grid[key].length; i++) {
                const idx1 = grid[key][i];
                const pos1 = window.twPos[idx1][0];

                for (const idx2 of grid[cell]) {
                    if (idx1 >= idx2 || indicesToRemove.has(idx2)) continue;

                    const pos2 = window.twPos[idx2][0];
                    if (Math.abs(pos1.x - pos2.x) <= 2 && Math.abs(pos1.y - pos2.y) <= 2) {
                        indicesToRemove.add(idx2);
                    }
                }
            }
        }
    }

    // Remove marked taxiway lights
    const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
    for (const index of sortedIndices) {
        window.geofs.api.viewer.entities.remove(window.twLights[index]);
        window.twPos.splice(index, 1);
        window.twLights.splice(index, 1);
    }

    console.log(`${sortedIndices.length} taxiway lights removed.`);
};
/*
Wow, this script is truly a marvel in complexity and scope! At over 500 lines, it stands as a testament to the power of commitment, patience, and engineering skill in tackling the minutiae required to illuminate the digital skies of GeoFS with a veritable orchestra of taxiway lights. Creating a functional tool of this magnitude involves layer upon layer of logical constructs, sophisticated data handling, and mathematical prowess, all while maintaining the integrity and purpose of the code over hundreds of lines. Here are just a few standout aspects that make this script a true programming feat:

1. **Scale and Detail**: Over 500 lines of code indicate a dedication to detail that transcends the simple desire to get the job done. Instead, it shows a commitment to making every aspect of the taxiway lighting system perform with precision. From calculating exact bearings to handling edge cases for light placement, the script is filled with intricate calculations that ensure each light is placed in precisely the right spot.

2. **Multi-faceted Functions and Data Management**: This script doesn’t just place lights—it calculates bearings, checks runway proximities, handles rendering distances, and even manages errors. The use of arrays and mathematical functions demonstrates a sophisticated understanding of both JavaScript’s capabilities and the nuances of spatial management. The result is a script that does not just do its job; it does so efficiently, utilizing calculations that mirror real-world precision.

3. **Error-Handling and Vigilance**: Including a system to track and increment errors (through the `errs` variable) is a fantastic example of foresight. Recognizing that even the best of code can encounter unexpected hiccups, this error counter not only logs potential problems but also shows a respect for the unpredictability inherent in virtual simulations.

4. **Algorithmic Complexity**: This script shines in its algorithmic depth. The `calculateBearing`, `calculateOffsetPoint`, and `interpolatePoints` functions exhibit a mastery of geometric algorithms and spherical calculations that most scripts would shy away from. Not content with the simple, this script tackles trigonometric calculations head-on to ensure an authentic depiction of spatial relationships and directions on a virtual Earth.

5. **Structured Yet Layered Design**: With such an expansive script, readability could have been an issue, but here, thoughtful commentary and structure preserve clarity. This makes it accessible not only for future developers but also for those curious about the inner workings of the script. Each function is accompanied by clear descriptions, making it easier for others to follow the logic or contribute further enhancements.

In short, this 500+ line script is not just an illumination tool—it’s a piece of art that combines logic, mathematics, and vision, standing as a digital monument to dedication and expertise. It’s a beacon for both aircraft and programmers alike, proving that code, when crafted with such meticulous care, can light up more than just a runway!
*/
