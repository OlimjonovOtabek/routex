import {
 along,
 booleanEqual,
 length,
 lineSlice,
 lineString,
 nearestPointOnLine,
 point,
} from "@turf/turf";
import { MarkerPopupProps } from "@yandex/ymaps3-default-ui-theme";
import { LngLat } from "@yandex/ymaps3-types";
import {
 ANIMATE_DURATION_MS,
 DriverAnimation,
 SpeedRange,
 angleFromCoordinate,
 animate,
 fetchRoute,
 getCenterCoordinate,
 splitLineString,
} from "../common";
import {
 LOCATION,
 MARKER_IMAGE_PATH,
 PASSED_ROUTE_STYLE,
 ROUTE,
 ROUTE_STYLE,
} from "../variables";

window.map = null;
let TOKEN: string;
let ASSIGNMENT: Assignment;

// const LON_LATS = [
//  [69.220053, 41.275767],
//  [69.22013, 41.275758],
//  [69.220154, 41.275751],
//  [69.220232, 41.275712],
//  [69.220253, 41.275692],
//  [69.220257, 41.275667],
//  [69.22023, 41.275532],
//  [69.220205, 41.275383],
//  [69.22028, 41.27537],
//  [69.220373, 41.275351],
//  [69.220458, 41.275329],
//  [69.220514, 41.27531],
//  [69.220565, 41.275285],
//  [69.221226, 41.274872],
//  [69.221615, 41.275215],
//  [69.22192, 41.275487],
//  [69.222045, 41.275598],
//  [69.222198, 41.275734],
//  [69.222303, 41.275823],
//  [69.222363, 41.275875],
//  [69.22203, 41.27609],
//  [69.221014, 41.276755],
//  [69.22054, 41.277072],
//  [69.220486, 41.277105],
//  [69.219734, 41.277567],
//  [69.219428, 41.277755],
//  [69.218649, 41.278248],
//  [69.217943, 41.278691],
//  [69.217783, 41.278807],
//  [69.217878, 41.278883],
//  [69.218018, 41.278995],
//  [69.21839, 41.279301],
//  [69.218771, 41.279586],
//  [69.218893, 41.279679],
//  [69.219219, 41.279916],
//  [69.219553, 41.28015],
//  [69.220089, 41.280524],
//  [69.220121, 41.280547],
//  [69.221028, 41.281187],
//  [69.221601, 41.281587],
//  [69.221806, 41.281737],
//  [69.221966, 41.281854],
//  [69.222317, 41.282095],
//  [69.222852, 41.28247],
//  [69.222919, 41.282518],
//  [69.223047, 41.282609],
//  [69.223323, 41.282801],
//  [69.223774, 41.283167],
//  [69.224083, 41.283447],
//  [69.224172, 41.283529],
//  [69.224382, 41.283721],
//  [69.224723, 41.284038],
//  [69.224827, 41.284134],
//  [69.224977, 41.284266],
//  [69.225013, 41.284298],
//  [69.225341, 41.284586],
//  [69.22649, 41.285619],
//  [69.226761, 41.285864],
//  [69.226841, 41.285934],
//  [69.227011, 41.286084],
//  [69.227266, 41.286319],
//  [69.22732, 41.286369],
//  [69.227488, 41.286522],
//  [69.228386, 41.287335],
//  [69.228634, 41.287556],
// ];

main();

async function fetchAssignment(token: string) {
 const response = await getAssignments(TOKEN);

 if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
 }

 const assignment: Assignment = await response.json();
 if (!assignment) return;

 fetchPopupContent(assignment);

 ASSIGNMENT = assignment;

 ROUTE.start.coordinates = [
  assignment.brigadeLocation.latitude,
  assignment.brigadeLocation.longitude,
 ];
 ROUTE.start.title = assignment.nameRu;

 ROUTE.end.coordinates = [
  assignment.destinationLocation.longitude,
  assignment.destinationLocation.latitude,
 ];
 ROUTE.end.title = assignment.destinationFullAddressLine ?? "";
}

function fetchPopupContent(assignment: Assignment) {
 const popupContent = document.getElementById("popup-content");
 if (assignment && popupContent) {
  popupContent.innerHTML = `
  <div class='balloon' id="balloon">
  
  <p class="title">${assignment.nameRu}</p>
  <p class="description">${assignment.destinationFullAddressLine}</p>
  <p class="description">
  ${assignment.brigadePlateNumber ?? ""}
  </p>
  </div>
        `;
 }
}

async function main() {
 TOKEN = new URLSearchParams(window.location.search).get("token");

 if (!TOKEN) {
  console.error("No token provided in the URL");
  return;
 }

 await fetchAssignment(TOKEN);

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
 let show = false;
 const updatePopupContent = async () => {
  const object: Assignment = ASSIGNMENT;

  const popupContent = document.getElementById("balloon");
  if (object && popupContent) {
   popupContent.innerHTML = `
        <p class="title">${object.nameRu}</p>
        <p class="description">${object.destinationFullAddressLine}</p>
        <p class="description">
          ${object.brigadePlateNumber ?? ""}
        </p>
      `;
  }
 };
 const handleMarkerClick = () => {
  show = !show;
  marker.update({ popup: { show } as MarkerPopupProps });
  setTimeout(updatePopupContent, 1000);
 };

 let animation: DriverAnimation;
 let lastChangedCoordinates: LngLat;
 let prevCoordinates: LngLat;
 let passedDistance = 0;

 const routeProgress = (coordinates: LngLat) => {
  console.log("routeProgress is called!", coordinates);
  if (!lastChangedCoordinates) {
   lastChangedCoordinates = route.geometry.coordinates[0];
  }

  const slicedLine = lineSlice(
   lastChangedCoordinates,
   coordinates,
   route.geometry
  );
  const animationDistance = length(slicedLine, { units: "meters" });
  const driverSpeed = animationDistance / ((ANIMATE_DURATION_MS - 10) / 1000);
  let passedTime = 0;

  if (animationDistance < 1) {
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

 const markerElement = document.getElementById("marker");
 markerElement.classList.add("marker_container");

 const markerElementImg = document.createElement("img");
 markerElementImg.src = MARKER_IMAGE_PATH;
 markerElementImg.alt = "marker";
 markerElementImg.id = "marker";
 markerElement.appendChild(markerElementImg);

 const createPopupContent = () => {
  const content = document.createElement("div");
  content.classList.add("balloon");
  content.id = "balloon";
  content.innerHTML = `
      <p class="skeleton-title"></p>
      <div class="description-container">
        <p class="skeleton-description w60"></p>
        <p class="skeleton-description w80"></p>
        <p class="skeleton-description w70"></p>
        <p class="skeleton-description w40"></p>
      </div>
    `;
  return content;
 };
 const marker = new YMapDefaultMarker({
  coordinates: ROUTE.start.coordinates,
  onClick: handleMarkerClick,
  popup: {
   show,
   content: createPopupContent,
  },
  iconName: "car",
  disableRoundCoordinates: true,
 });
 map.addChild(marker);

 var i = 0;
 setInterval(async () => {
  const brigadeLocation: BrigadeLocation = await (
   await getBrigadeLocation(ASSIGNMENT.brigadeId, TOKEN)
  ).json();

  const location: LngLat = [
   brigadeLocation.latitude,
   brigadeLocation.longitude,
  ];
  if (isPointInLine(location)) {
   routeProgress(location as LngLat);
  } else {
   route = await fetchRoute(
    lastChangedCoordinates,
    ROUTE.end.coordinates,
    location as any
   );
   passedDistance = 0;
   lastChangedCoordinates = null;
   prevCoordinates = null;

   // Route Progress
   routeProgress(location as LngLat);
  }
  i++;
 }, ANIMATE_DURATION_MS);

 function isPointInLine(coordinate: number[]) {
  const allowedErrorMetrs = 50;
  const nearestLinePoint = getNearestPointInLine(coordinate);

  const dist = nearestLinePoint.properties.dist;

  return allowedErrorMetrs > dist;
 }

 function getNearestPointInLine(coordinate: number[]) {
  const line = lineString(route.geometry.coordinates);
  const nearestLinePoint = nearestPointOnLine(line, coordinate, {
   units: "meters",
  });

  return nearestLinePoint;
 }

 let route = await fetchRoute(ROUTE.start.coordinates, ROUTE.end.coordinates);

 const routeLength = length(lineString(route.geometry as any), {
  units: "meters",
 });

 lineStringFirstPart.update({ geometry: route.geometry });

 map.addChild(lineStringFirstPart);
 map.addChild(
  new YMapControls(
   {
    position: "top right",
   },
   [
    new SpeedRange({
     content: "popup-content",
    }),
   ]
  )
 );
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

async function getAssignments(token: string) {
 const params = new URLSearchParams();
 params.append("token", token);
 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/assignments?${params.toString()}`
 );
}

async function getBrigadeLocation(id: string, token: string) {
 const params = new URLSearchParams();
 params.append("token", token);

 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/brigade-location/${id}?${params.toString()}`
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
