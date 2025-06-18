import { along, booleanEqual, length, lineString, point } from "@turf/turf";
import { type LngLat } from "@yandex/ymaps3-types";
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
 TOKEN = await (await getToken()).text();
 ASSIGNMENT = await (await getAssignments()).json();
 ROUTE.start.coordinates = [
  ASSIGNMENT.brigadeLocation.latitude,
  ASSIGNMENT.brigadeLocation.longitude,
 ];
 ROUTE.start.title = ASSIGNMENT.nameRu;

 ROUTE.end.coordinates = [
  ASSIGNMENT.destinationLocation.longitude,
  ASSIGNMENT.destinationLocation.latitude,
 ];
 ROUTE.end.title = ASSIGNMENT.destinationFullAddressLine;
 console.log(ASSIGNMENT);
 const lonLats = [
  {
   lon: 69.26319372831537,
   lat: 41.30509406674733,
  },
  {
   lon: 69.26200096724999,
   lat: 41.304789041824904,
  },
  {
   lon: 69.25814352720873,
   lat: 41.30368331452013,
  },
  {
   lon: 69.25580876086796,
   lat: 41.3027110215707,
  },
  {
   lon: 69.2574075682535,
   lat: 41.3015289988532,
  },
  {
   lon: 69.25611329560805,
   lat: 41.300194431325735,
  },
  {
   lon: 69.2539815524275,
   lat: 41.301243022396335,
  },
  {
   lon: 69.25256039030701,
   lat: 41.30122395725465,
  },
 ];
 const locationBrigade = await (await getBrigadeLocation()).text();
 console.log(locationBrigade);
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
 let driverSpeed = INITIAL_DRIVER_SPEED;
 let prevCoordinates: LngLat;

 const routeProgress = (initDistance: number) => {
  let passedDistance = initDistance;
  let passedTime = 0;
  animation = animate((progress) => {
   const timeS = (progress * ANIMATE_DURATION_MS) / 1000;
   const length = passedDistance + driverSpeed * (timeS - passedTime);

   const nextCoordinates = along(route.geometry, length, {
    units: "meters",
   }).geometry.coordinates as LngLat;

   marker.update({ coordinates: nextCoordinates });
   if (
    prevCoordinates &&
    !booleanEqual(point(prevCoordinates), point(nextCoordinates))
   ) {
    const angle = angleFromCoordinate(prevCoordinates, nextCoordinates);
    const markerElement = document.getElementById("marker");
    markerElement.style.transform = `rotate(${angle}deg)`;
   }

   const [newLineStingFirstPart, newLineStringSecondPart] = splitLineString(
    route,
    nextCoordinates
   );
   lineStringFirstPart.update({ geometry: newLineStingFirstPart });
   lineStringSecondPart.update({ geometry: newLineStringSecondPart });

   prevCoordinates = nextCoordinates;
   passedTime = timeS;
   passedDistance = length;

   if (progress === 1 && routeLength > length) {
    routeProgress(length);
   }
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
 map.addChild(new YMapDefaultMarker(ROUTE.start));
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

 map
  .addChild(
   new YMapControls({ position: "bottom" }, [
    new ResetButton({
     onClick: () => {
      const animationId = animation.getAnimationId();
      cancelAnimationFrame(animationId);
      marker.update({ coordinates: ROUTE.start.coordinates });
      routeProgress(0);
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
      driverSpeed = value;
     },
    }),
   ])
  );

 let counter = 0;

 setInterval(() => {
  console.log(counter++);
  console.log(counter);
 }, 10000);

 const route = await fetchRoute(ROUTE.start.coordinates, ROUTE.end.coordinates);

 const routeLength = length(lineString(route.geometry as any), {
  units: "meters",
 });

 lineStringFirstPart.update({ geometry: route.geometry });

 map.addChild(lineStringFirstPart);
 map.addChild(lineStringSecondPart);
 routeProgress(0);
}

async function getToken(
 assignmentId: string = "a487c7a1-6f8b-469e-bd62-1c6688df1d82",
 createdAt: string = "2025-06-18T16:25:51.138427+05:00"
) {
 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/get-token?assignmentId=${assignmentId}&createdAt=${createdAt}`
 );
}

async function getAssignments() {
 return fetch(
  `https://103.init.uz/brigade-tracking-service/api/brigade-tracking/assignments/hbCt-UsCRGgLF_I_ohwAIhWUsJ4XyE37KJ0mRDRy7FY.`
 );
}

async function getBrigadeLocation(
 id: string = "09fc261e-c281-49be-8d7d-af8f2169f5c5",
 token: string = "hbCt-UsCRGgLF_I_ohwAIhWUsJ4XyE37KJ0mRDRy7FY."
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
