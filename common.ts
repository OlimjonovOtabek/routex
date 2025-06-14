import { cleanCoords, lineSlice } from "@turf/turf";
import type {
 LineStringGeometry,
 LngLat,
 RouteFeature,
} from "@yandex/ymaps3-types";

// Wait for the api to load to access the map configuration
ymaps3.ready.then(() => {
 // Copy your api key for routes from the developer's dashboard and paste it here
 ymaps3
  .getDefaultConfig()
  .setApikeys({ router: "55ce4372-6a6e-4f24-bc5f-ae440bfea5dc" });
 ymaps3.import.registerCdn(
  "https://cdn.jsdelivr.net/npm/{package}",
  "@yandex/ymaps3-default-ui-theme@0.0"
 );
});

export async function fetchRoute(
 startCoordinates: LngLat,
 endCoordinates: LngLat
) {
 // Request a route from the Router API with the specified parameters.
 const routes = await ymaps3.route({
  points: [startCoordinates, endCoordinates], // Start and end points of the route LngLat[]
  type: "driving", // Type of the route
  bounds: true, // Flag indicating whether to include route boundaries in the response
 });

 // Check if a route was found
 if (!routes[0]) return;

 // Convert the received route to a RouteFeature object.
 const route = routes[0].toRoute();

 // Check if a route has coordinates
 if (route.geometry.coordinates.length == 0) return;

 return route;
}

export const ANIMATE_DURATION_MS = 1000000;
export type DriverAnimation = {
 getAnimationId: () => number;
};

export function animate(cb: (progress: number) => void): DriverAnimation {
 let animationId = 0;
 const startTime = Date.now();
 function tick() {
  const progress = (Date.now() - startTime) / ANIMATE_DURATION_MS;
  if (progress >= 1) {
   cb(1);
   return;
  }

  cb(progress);
  animationId = requestAnimationFrame(tick);
 }

 animationId = requestAnimationFrame(tick);

 return {
  getAnimationId: () => animationId,
 };
}

export function angleFromCoordinate(lngLat1: LngLat, lngLat2: LngLat) {
 const toRadians = (degrees: number) => degrees * (Math.PI / 180);
 const toDegrees = (radians: number) => radians * (180 / Math.PI);

 const dLon = toRadians(lngLat2[0] - lngLat1[0]);

 const y = Math.sin(dLon) * Math.cos(toRadians(lngLat2[1]));
 const x =
  Math.cos(toRadians(lngLat1[1])) * Math.sin(toRadians(lngLat2[1])) -
  Math.sin(toRadians(lngLat1[1])) *
   Math.cos(toRadians(lngLat2[1])) *
   Math.cos(dLon);

 let deg = Math.atan2(y, x);

 deg = toDegrees(deg);
 deg = (deg + 360) % 360;

 return deg;
}

export function splitLineString(route: RouteFeature, coordinates: LngLat) {
 if (!route || !coordinates) {
  return [];
 }

 console.log(route.geometry);
 route.geometry = cleanCoords(route.geometry);
 const firstPart = lineSlice(
  coordinates,
  route.geometry.coordinates[route.geometry.coordinates.length - 1],
  route.geometry
 );
 const secondPart = lineSlice(
  route.geometry.coordinates[0],
  coordinates,
  route.geometry
 );
 return [
  firstPart.geometry as LineStringGeometry,
  secondPart.geometry as LineStringGeometry,
 ];
}

export function getCenterCoordinate(start: LngLat, end: LngLat): number[] {
 const centerLongitude = (start[0] + end[0]) / 2;
 const centerLatitude = (start[1] + end[1]) / 2;
 return [centerLongitude, centerLatitude];
}

// Helper function to remove consecutive duplicate coordinates
function removeConsecutiveDuplicates(coords: number[][]): number[][] {
 if (!coords.length) return coords;
 const cleaned = [coords[0]];
 for (let i = 1; i < coords.length; i++) {
  const [lon, lat] = coords[i];
  const [prevLon, prevLat] = coords[i - 1];
  if (lon !== prevLon || lat !== prevLat) {
   cleaned.push(coords[i]);
  }
 }
 return cleaned;
}
