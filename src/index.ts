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
} from "./common";
import {
 LOCATION,
 MARKER_IMAGE_PATH,
 PASSED_ROUTE_STYLE,
 ROUTE,
 ROUTE_STYLE,
} from "./variables";

window.map = null;
let TOKEN: string;
let ASSIGNMENT: Assignment;

main();

async function fetchAssignment(token: string) {
 const response = await getAssignments(TOKEN);

 if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
 }

 const assignment: Assignment = await response.json();
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

async function main() {
 TOKEN = new URLSearchParams(window.location.search).get("token");

 if (!TOKEN) {
  console.error("No token provided in the URL");
  return;
 }

 await fetchAssignment(TOKEN);

 //  Waiting for all api elements to be loaded
 await ymaps3.ready;
 const {
  YMap,
  YMapDefaultSchemeLayer,
  YMapDefaultFeaturesLayer,
  YMapFeature,
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
