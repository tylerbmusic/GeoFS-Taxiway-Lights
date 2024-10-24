// ==UserScript==
// @name         GeoFS Taxiway Lights
// @version      0.1
// @description  Adds a tool to add taxiway lights
// @author       GGamerGGuy
// @match        https://www.geo-fs.com/geofs.php?v=*
// @match        https://*.geo-fs.com/geofs.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geo-fs.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    window.twLights = [];
    window.twPos = [];
    window.currLight;
    /*window.lightDiv = document.createElement("div");
    window.lightDiv.style.position = "fixed";
    window.lightDiv.style.top = "20%";
    window.lightDiv.style.height = "fit-content";
    window.lightDiv.style.display = "block";
    window.lightDiv.className = "geofs-ui-left";
    document.body.appendChild(window.lightDiv);
    const html = `
    <button onclick="newLight()">Place New Light</button>
    <button onclick="moveLight('n')">North</button>
    <button onclick="moveLight('e')">East</button>
    <button onclick="moveLight('s')">South</button>
    <button onclick="moveLight('w')">West</button>
    `;
    window.lightDiv.innerHTML = html;
    document.addEventListener('keydown', function(event) {
        if (event.key == "ArrowUp") {
            window.moveLight("n");
        } else if (event.key == "ArrowRight") {
            window.moveLight("e");
        } else if (event.key == "ArrowDown") {
            window.moveLight("s");
        } else if (event.key == "ArrowLeft") {
            window.moveLight("w");
        }
    });*/
    setInterval(() => {window.updateLights();}, 10000);
})();
window.updateLights = async function() {
    if (window.geofs.cautiousWithTerrain == false) {
        var renderDistance = 0.25; //Render distance, in degrees.
        var l0 = Math.floor(window.geofs.aircraft.instance.llaLocation[0]/renderDistance)*renderDistance;
        var l1 = Math.floor(window.geofs.aircraft.instance.llaLocation[1]/renderDistance)*renderDistance;
        var bounds = (l0) + ", " + (l1) + ", " + (l0+renderDistance) + ", " + (l1+renderDistance);
        if (!window.lastBounds || (window.lastBounds != bounds)) {
            //Remove existing lights
            for (var i = 0; i < window.twLights.length; i++) {
            window.geofs.api.viewer.entities.remove(window.twLights[i]);
            }
            console.log("Lights removed, placing taxiway edge lights");
            //Place new lights
            window.getTwD(bounds); //getTaxiwayData
            console.log("Placing taxiway centerline lights");
            window.getTwDE(bounds); //getTaxiwayDataEdgeless
        }
        window.lastBounds = bounds;
    }
}
window.newLight = function() {
    var pos;
    if (window.twPos[0]) {
        pos = window.Cesium.Cartesian3.fromDegrees(window.twPos[window.twPos.length - 1][0], window.twPos[window.twPos.length - 1][1], window.twPos[window.twPos.length - 1][2]);
        window.twPos.push([window.twPos[window.twPos.length - 1][0], window.twPos[window.twPos.length - 1][1], window.twPos[window.twPos.length - 1][2]]);
    } else {
        pos = window.Cesium.Cartesian3.fromDegrees(window.geofs.camera.lla[1], window.geofs.camera.lla[0], (window.geofs.animation.values.groundElevationFeet/3.2808399));
        window.twPos.push([window.geofs.camera.lla[1], window.geofs.camera.lla[0], (window.geofs.animation.values.groundElevationFeet/3.2808399)]);
    }
    const hpr = new window.Cesium.HeadingPitchRoll(0,0,0);
    const ori = window.Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);
    window.twLights.push(
        window.geofs.api.viewer.entities.add({
            name: "twLt",
            position: pos,
            orientation: ori,
            model: {
                uri: "https://raw.githubusercontent.com/tylerbmusic/GPWS-files_geofs/refs/heads/main/tw_blue.glb",
                minimumPixelSize: 64, //I have no idea what this does..
                maximumScale: 1
            }
        })
    );
    window.currLight = window.twLights[window.twLights.length - 1];
};
window.moveLight = function(placeDir) {
    if (!window.currLight) return;
    var pos = window.twPos[window.twPos.length - 1];
    pos[2] = window.geofs.getGroundAltitude(pos).location[2]; //Altitude Above Ground
    // Move the light based on direction
    switch (placeDir) {
        case "n": // North
            pos[1] -= 0.000005;
            break;
        case "s": // South
            pos[1] += 0.000005;
            break;
        case "e": // East
            pos[0] -= 0.000005;
            break;
        case "w": // West
            pos[0] += 0.000005;
            break;
    }
    pos[0] = Math.round(pos[0]*200000)/200000;
    pos[1] = Math.round(pos[1]*200000)/200000;

    // Update the light position
    window.currLight.position = window.Cesium.Cartesian3.fromDegrees(pos[0], pos[1], pos[2]);
};
window.copyPos = function() {
    var ret = "";
    for (var i in window.twPos) {
        ret += "[";
        for (var j in window.twPos[i]) {
            ret += window.twPos[i][j] + ", ";
        }
        ret = ret.substr(0,ret.length - 2);
        ret += "], ";
    }
    ret = ret.substr(0,ret.length - 2);
    window.copyToClipboard(ret);
    return ret;
};
window.copyToClipboard = function(text) { //WARNING: This function (except this line) was generated by AI
    // Create a temporary textarea element to hold the text
    var textarea = document.createElement("textarea");
    textarea.value = text;

    // Append the textarea to the document body
    document.body.appendChild(textarea);

    // Select the text within the textarea
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices

    // Copy the text to the clipboard
    document.execCommand("copy");

    // Remove the temporary textarea
    document.body.removeChild(textarea);

    console.log('Copied to clipboard:', text);
}
/*async function getTaxiwayDataEdgeless(bounds) {
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
        window.theNodes = [];
        const response = await fetch(`${overpassUrl}?data=${encodeURIComponent(query.replace('{{bbox}}', bbox))}`);
        const data = await response.json();

        // Extract taxiway points
        const taxiwayPoints = [];
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
                    window.theNodes.push(node);
                    if (node) {
                        return [node.lon, node.lat, 0]; // Assuming ground level
                    }
                }).filter(Boolean);

                taxiwayPoints.push(...wayNodes);
            }
        });

        return taxiwayPoints;
    } catch (error) {
        console.error('Error fetching taxiway data:', error);
    }
}*/
function calculateOffsetPoint(lon, lat, offsetDistance) {
    const R = 6378137; // Earth's radius in meters

    const dLat = offsetDistance / R;
    const dLon = offsetDistance / (R * Math.cos(Math.PI * lat / 180));

    return {
        lonPlus: lon + dLon * 180 / Math.PI,
        latPlus: lat + dLat * 180 / Math.PI,
        lonMinus: lon - dLon * 180 / Math.PI,
        latMinus: lat - dLat * 180 / Math.PI
    };
}

/*async function getTaxiwayData(bounds) {
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

        // Extract taxiway points
        const taxiwayEdges = [];
        const nodes = {};

        // First, store all nodes in an object for easy lookup
        data.elements.forEach(element => {
            if (element.type === 'node') {
                nodes[element.id] = element;
            }
        });

        // Then, go through the ways and get their nodes
        data.elements.forEach(element => {
            if (element.type === 'way') {
                const wayNodes = element.nodes.map(nodeId => {
                    const node = nodes[nodeId];
                    if (node) {
                        return [node.lon, node.lat, 0]; // Assuming ground level
                    }
                }).filter(Boolean);

                if (wayNodes.length > 0) {
                    // Calculate edge points for each node
                    const edgePoints = wayNodes.map(([lon, lat, alt]) => {
                        const offset = 10; // 10 meters from the centerline
                        const offsetPoints = calculateOffsetPoint(lon, lat, offset);
                        return [
                            [offsetPoints.lonPlus, offsetPoints.latPlus, alt],
                            [offsetPoints.lonMinus, offsetPoints.latMinus, alt]
                        ];
                    });
                    taxiwayEdges.push(edgePoints);
                }
            }
        });

        return taxiwayEdges;
    } catch (error) {
        console.error('Error fetching taxiway data:', error);
    }
}
window.getTwD = async function(bounds) {
    getTaxiwayData(bounds).then(tw => {
        tw.forEach((edge, index) => {
            for (var i = 0; i < edge.length; i++) {
                for (var j = 0; j < edge[i].length; j++) {
                        const epos = edge[i][j];
                        const apos = window.geofs.getGroundAltitude([epos[1], epos[0], epos[2]]).location;
                        const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2]);
                        window.twLights.push(
                            window.geofs.api.viewer.entities.add({
                                position: pos,
                                billboard: {
                                    image: "https://tylerbmusic.github.io/GPWS-files_geofs/bluelight.png",
                                    scale: 0.07 * (1/window.geofs.api.renderingSettings.resolutionScale),
                                },
                            })
                        );
                    //}
                }
            }
        });
    });
};*/
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
                    const interval = 0.0003; // Adjust for desired spacing

                    for (let i = 0; i < wayNodes.length - 1; i++) {
                        const segmentPoints = interpolatePoints(wayNodes[i], wayNodes[i + 1], interval);

                        // Calculate edge points for each interpolated point
                        const offset = 10; // 10 meters from centerline
                        const interpolatedEdgePoints = segmentPoints.map(([lon, lat, alt]) => {
                            const offsetPoints = calculateOffsetPoint(lon, lat, offset);
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
                    const interval = 0.0002; // Adjust for desired spacing

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
                    const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2]);
                    window.twLights.push(
                        window.geofs.api.viewer.entities.add({
                            position: pos,
                            billboard: {
                                image: "https://tylerbmusic.github.io/GPWS-files_geofs/bluelight.png",
                                scale: 0.05 * (1 / window.geofs.api.renderingSettings.resolutionScale),
                            },
                        })
                    );
                });
            });
        });
    });
};

window.getTwDE = async function(bounds) {
    getTaxiwayDataEdgeless(bounds).then(centerline => {
        centerline.forEach(epos => {
            const apos = window.geofs.getGroundAltitude([epos[1], epos[0], epos[2]]).location;
            const pos = window.Cesium.Cartesian3.fromDegrees(apos[1], apos[0], apos[2]);
            window.twLights.push(
                window.geofs.api.viewer.entities.add({
                    position: pos,
                    billboard: {
                        image: "https://tylerbmusic.github.io/GPWS-files_geofs/greenlight.png",
                        scale: 0.07 * (1 / window.geofs.api.renderingSettings.resolutionScale),
                    },
                })
            );
        });
    });
};
