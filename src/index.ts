import {
 booleanEqual,
 length,
 lineString,
 nearestPointOnLine,
 point,
 along,
 lineSliceAlong,
 lineSlice
} from "@turf/turf";
import { LngLat } from "@yandex/ymaps3-types";
import {
    ANIMATE_DURATION_MS,
 DriverAnimation,
 angleFromCoordinate,
 animate,
 fetchRoute,
 getCenterCoordinate,
 splitLineString,
} from "../common";
import {
 INITIAL_DRIVER_SPEED,
 LOCATION,
 MARKER_IMAGE_PATH,
 MAX_DRIVER_SPEED,
 MIN_DRIVER_SPEED,
 PASSED_ROUTE_STYLE,
 ROUTE,
 ROUTE_STYLE,
} from "../variables";

window.map = null;
let TOKEN: string;
let ASSIGNMENT: Assignment;
main();

async function main() {
 //  TOKEN = await (await getToken()).text();
 //  ASSIGNMENT = await (await getAssignments()).json();
 //  ROUTE.start.coordinates = [
 //   ASSIGNMENT.brigadeLocation.latitude,
 //   ASSIGNMENT.brigadeLocation.longitude,
 //  ];
 //  ROUTE.start.title = ASSIGNMENT.nameRu;

 //  ROUTE.end.coordinates = [
 //   ASSIGNMENT.destinationLocation.longitude,
 //   ASSIGNMENT.destinationLocation.latitude,
 //  ];
 //  ROUTE.end.title = ASSIGNMENT.destinationFullAddressLine ?? "";
 console.log(ASSIGNMENT);
 const lonLats = [
  [69.220053, 41.275767],
  [69.22013, 41.275758],
  [69.220154, 41.275751],
  [69.220232, 41.275712],
  [69.220253, 41.275692],
  [69.220257, 41.275667],
  [69.22023, 41.275532],
  [69.220205, 41.275383],
  [69.22028, 41.27537],
  [69.220373, 41.275351],
  [69.220458, 41.275329],
  [69.220514, 41.27531],
  [69.220565, 41.275285],
  [69.221226, 41.274872],
  [69.221615, 41.275215],
  [69.22192, 41.275487],
  [69.222045, 41.275598],
  [69.222198, 41.275734],
  [69.222303, 41.275823],
  [69.222363, 41.275875],
  [69.22203, 41.27609],
  [69.221014, 41.276755],
  [69.22054, 41.277072],
  [69.220486, 41.277105],
  [69.219734, 41.277567],
  [69.219428, 41.277755],
  [69.218649, 41.278248],
  [69.217943, 41.278691],
  [69.217783, 41.278807],
  [69.217878, 41.278883],
  [69.218018, 41.278995],
  [69.21839, 41.279301],
  [69.218771, 41.279586],
  [69.218893, 41.279679],
  [69.219219, 41.279916],
  [69.219553, 41.28015],
  [69.220089, 41.280524],
  [69.220121, 41.280547],
  [69.221028, 41.281187],
  [69.221601, 41.281587],
  [69.221806, 41.281737],
  [69.221966, 41.281854],
  [69.222317, 41.282095],
  [69.222852, 41.28247],
  [69.222919, 41.282518],
  [69.223047, 41.282609],
  [69.223323, 41.282801],
  [69.223774, 41.283167],
  [69.224083, 41.283447],
  [69.224172, 41.283529],
  [69.224382, 41.283721],
  [69.224723, 41.284038],
  [69.224827, 41.284134],
  [69.224977, 41.284266],
  [69.225013, 41.284298],
  [69.225341, 41.284586],
  [69.22649, 41.285619],
  [69.226761, 41.285864],
  [69.226841, 41.285934],
  [69.227011, 41.286084],
  [69.227266, 41.286319],
  [69.22732, 41.286369],
  [69.227488, 41.286522],
  [69.228386, 41.287335],
  [69.228634, 41.287556],
 ];
//  const locationBrigade = await (await getBrigadeLocation()).text();
//  console.log(locationBrigade);
 //  Waiting for all api elements to be loaded
 await ymaps3.ready;
 const {
  YMap,
  YMapDefaultSchemeLayer,
  YMapDefaultFeaturesLayer,
  YMapFeature,
  YMapMarker,
  YMapControls,
  YMapControl,
 } = ymaps3;

 // Import the package to add a default marker
 const { YMapDefaultMarker } = await ymaps3.import(
  "@yandex/ymaps3-default-ui-theme"
 );

 // Initialize the map
 map = new YMap(
  // Pass the link to the HTMLElement of the container
  document.getElementById("map"),
  // Pass the map initialization parameters
  { location: LOCATION, showScaleInCopyrights: true },
  [
   // Add a map scheme layer
   new YMapDefaultSchemeLayer({}),
   // Add a layer of geo objects to display the markers
   new YMapDefaultFeaturesLayer({}),
  ]
 );

 class ResetButton extends ymaps3.YMapComplexEntity<{ onClick: () => void }> {
  private _element!: HTMLButtonElement;

  // Method for create a DOM control element
  _createElement() {
   // Create a root element
   const button = document.createElement("button");
   button.classList.add("button");
   button.innerText = "Restart";
   return button;
  }

  // Method for attaching the control to the map
  _onAttach() {
   this._element = this._createElement();
   this._element.addEventListener("click", this._onClick);

   const control = new YMapControl({}, this._element);
   this.addChild(control);
  }

  // Method for detaching control from the map
  _onDetach() {
   this._element.removeEventListener("click", this._onClick);
  }

  _onClick = () => {
   this._props.onClick();
  };
 }

 type SpeedRangeProps = {
  onChange: (value: number) => void;
  initialValue: number;
  min: number;
  max: number;
 };

 class SpeedRange extends ymaps3.YMapComplexEntity<SpeedRangeProps> {
  private _element!: HTMLDivElement;
  private _input!: HTMLInputElement;

  // Method for create a DOM control element
  _createElement() {
   // Create a root element
   const container = document.createElement("div");
   container.classList.add("container");

   const text = document.createElement("div");
   text.classList.add("text");
   text.innerText = "speed";

   this._input = document.createElement("input");
   this._input.id = "range";
   this._input.type = "range";
   this._input.min = this._props.min.toString();
   this._input.max = this._props.max.toString();
   this._input.step = "1";
   this._input.value = this._props.initialValue.toString();
   this._input.classList.add("slider");
   const percent = this.__getPercent(this._props.initialValue);
   this._input.style.background = `linear-gradient(to right, #122DB2 ${percent}%, #F5F6F7 ${percent}%)`;
   this._input.addEventListener("input", this._onInput);

   container.appendChild(text);
   container.appendChild(this._input);

   return container;
  }

  __getPercent(value: number) {
   return (
    ((value - this._props.min) / (this._props.max - this._props.min)) * 100
   );
  }

  // Method for attaching the control to the map
  _onAttach() {
   const { YMapControl } = ymaps3;
   this._element = this._createElement();
   const control = new YMapControl({ transparent: true }, this._element);
   this.addChild(control);
  }

  // Method for detaching control from the map
  _onDetach() {
   this._input.removeEventListener("input", this._onInput);
  }

  _onInput = () => {
   const value = Number(this._input.value);
   this._props.onChange(value);
   const percent = this.__getPercent(value);
   this._input.style.background = `linearGradient(to right, #122DB2 ${percent}%, #F5F6F7 ${percent}%)`;
  };
 }

 let animation: DriverAnimation;
 let lastChangedCoordinates: LngLat;
 let prevCoordinates: LngLat;
 let passedDistance = 0;

 const routeProgress = (coordinates: LngLat) => {
  console.log("routeProgress is called!", coordinates);
  if (!lastChangedCoordinates)
  {
    lastChangedCoordinates = route.geometry.coordinates[0];
  }

  const slicedLine = lineSlice(lastChangedCoordinates, coordinates, route.geometry)
  const animationDistance = length(slicedLine, {units: "meters"});
  const driverSpeed = animationDistance / ((ANIMATE_DURATION_MS - 10) / 1000);
  let passedTime = 0;
  debugger;

  if (animationDistance < 1)
  {
    return;
  }

  lastChangedCoordinates = coordinates;

  animation = animate((progress) => {
    const timeS = (progress * ANIMATE_DURATION_MS) / 1000;
    const length = passedDistance + driverSpeed * (timeS - passedTime);

    // Calculate the next location
    const nextCoordinates = along(route.geometry, length, {
        units: "meters",
    }).geometry.coordinates as LngLat;

    // Update the coordinates
    marker.update({ coordinates: nextCoordinates });

    // Correct the angles
    if (
        prevCoordinates &&
        !booleanEqual(point(prevCoordinates), point(nextCoordinates))
    ) {
        const angle = angleFromCoordinate(prevCoordinates, nextCoordinates);
        const markerElement = document.getElementById("marker");
        markerElement.style.transform = `rotate(${angle}deg)`;
    }

    // Correct the line
    const [newLineStingFirstPart, newLineStringSecondPart] = splitLineString(
        route,
        nextCoordinates
    );
    lineStringFirstPart.update({ geometry: newLineStingFirstPart });

    prevCoordinates = nextCoordinates;
    passedDistance = length;
    passedTime = timeS;

   //  if (progress === 1 && routeLength > length) {
   //   routeProgress(length);
   //  }
  });
 };

 const centerLocation = getCenterCoordinate(
  ROUTE.start.coordinates,
  ROUTE.end.coordinates
 );
 map.setLocation({
  center: centerLocation as any,
  zoom: 13,
 });

 const lineStringSecondPart = new YMapFeature({
  geometry: { coordinates: [], type: "LineString" },
  style: PASSED_ROUTE_STYLE,
 });

 const lineStringFirstPart = new YMapFeature({
  geometry: { coordinates: [], type: "LineString" },
  style: ROUTE_STYLE,
 });

 const location = getCenterCoordinate(
  ROUTE.start.coordinates,
  ROUTE.end.coordinates
 );
 map.setLocation({
  center: location as any,
  zoom: 13,
 });
 //  map.addChild(new YMapDefaultMarker(ROUTE.start));
 map.addChild(new YMapDefaultMarker(ROUTE.end));

 const markerElement = document.createElement("div");
 markerElement.classList.add("marker_container");

 const markerElementImg = document.createElement("img");
 markerElementImg.src = MARKER_IMAGE_PATH;
 markerElementImg.alt = "marker";
 markerElementImg.id = "marker";
 markerElement.appendChild(markerElementImg);

 const marker = new YMapMarker(
  {
   coordinates: ROUTE.start.coordinates,
   disableRoundCoordinates: true,
  },
  markerElement
 );
 map.addChild(marker);

 var i = 0;
 setInterval(async () => {
  var loc = lonLats[i];

  if (isPointInLine(loc)) {
   routeProgress(loc as LngLat);
  } else {
   route = await fetchRoute(loc as LngLat, ROUTE.end.coordinates);
   passedDistance = 0;
   routeProgress(loc as LngLat);
  }
  i++;
 }, ANIMATE_DURATION_MS);

 function isPointInLine(coordinate: number[]) {
  const allowedErrorMetrs = 50;
  const nearestLinePoint = getNearestPointInLine(coordinate);

  const dist = nearestLinePoint.properties.dist;

  return allowedErrorMetrs > dist;
 }

 function getNearestPointInLine(coordinate: number[]){

  const line = lineString(route.geometry.coordinates);
  const nearestLinePoint = nearestPointOnLine(line, coordinate, {
   units: "meters",
  })

  return nearestLinePoint;
 }
 map
  .addChild(
   new YMapControls({ position: "bottom" }, [
    new ResetButton({
     onClick: () => {
      const animationId = animation.getAnimationId();
      cancelAnimationFrame(animationId);
      marker.update({ coordinates: ROUTE.start.coordinates });
      // routeProgress(0);
     },
    }),
   ])
  )
  .addChild(
   new YMapControls({ position: "top right" }, [
    new SpeedRange({
     initialValue: INITIAL_DRIVER_SPEED,
     min: MIN_DRIVER_SPEED,
     max: MAX_DRIVER_SPEED,
     onChange: (value) => {
    //   driverSpeed = value;
     },
    }),
   ])
  );

 let route = await fetchRoute(ROUTE.start.coordinates, ROUTE.end.coordinates);

 const routeLength = length(lineString(route.geometry as any), {
  units: "meters",
 });

 lineStringFirstPart.update({ geometry: route.geometry });

 map.addChild(lineStringFirstPart);
 // map.addChild(lineStringSecondPart);
 //  routeProgress(0);
}

async function getToken(
 assignmentId: string = "4a1fb2c7-dd3b-4c7e-a2f9-a4ce8570729e",
 createdAt: string = "2025-06-19T17:34:53.642273+05:00"
) {
 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/get-token?assignmentId=${assignmentId}&createdAt=${createdAt}`
 );
}

async function getAssignments() {
 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/assignments/fIaby78fVeYWnGjcXpbJWsLwsv2HvaWqrsl-ffR2gL0.`
 );
}

async function getBrigadeLocation(
 id: string = "09fc261e-c281-49be-8d7d-af8f2169f5c5",
 token: string = "fIaby78fVeYWnGjcXpbJWsLwsv2HvaWqrsl-ffR2gL0."
) {
 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/brigade-location/${id}?token=${token}`
 );
}

interface Assignment {
 brigadeId: string;
 brigadePlateNumber: string | null;
 destinationLocation: {
  latitude: number;
  longitude: number;
 };
 brigadeLocation: {
  latitude: number;
  longitude: number;
 };

 destinationFullAddressLine: string;
 name: string;
 nameRu: string;
 nameUz: string | null;
 nameKa: string | null;
}

interface BrigadeLocation {
 latitude: number;
 longitude: number;
}
