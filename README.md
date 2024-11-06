## Taxiway Lights for GeoFS

This is a JavaScript plugin for GeoFS that adds taxiway lights around airports. The script automatically places edge and centerline lights along taxiways based on the aircraft's position.

## Features

- **Runway Intersection Indicator**: Centerline lights switch to yellow when close to a runway to help distinguish intersections.
- **Performance Optimization**: Lights that are too close to each other are removed to avoid clutter and improve performance, lights are also removed automatically if they are far away from you.

## Getting Started

1. **Installation**:
   - Use a userscript extension like Tampermoney or Violentmoney to manage and run userscripts.
   - Once the extension is installed, create a new script, paste in the code from userscript.js, and save it.

2. **Customization (Optional)**:
   - You can adjust parameters such as render distance, light color, and distance between lights by editing the script if you are comfortable with JavaScript.

## FAQ

### How does the script work?
The script takes taxiway data from OpenStreetMap based on your location in game. It then calculates positions for lights along the edges and centerline of nearby taxiways.

### Why do the lights change color near runways?
Centerline lights turn yellow when near runways to help identify runway intersections more easily.

### Will this script impact the performace?
The script is optimized to remove lights that are no longer in your vicinity and to avoid placing lights too close together. However, performance may vary depending on your computer's specs.

![image](https://github.com/user-attachments/assets/c524e9a3-f1eb-4675-8e1e-c32749c901e2)
