import {
    along,
    booleanEqual,
    length,
    lineSlice,
    lineString,
    nearestPointOnLine,
    point
} from "@turf/turf";
import {
    ANIMATE_DURATION_MS,
    DriverAnimation,
    angleFromCoordinate,
    animate,
    fetchRoute,
    getCenterCoordinate,
    splitLineString,
} from "./common";
import { BASE_URL, LOCATION, MARKER_IMAGE_SVG, ROUTE, ROUTE_STYLE } from "./variables";
import { LngLat } from "@yandex/ymaps3-types";

window.map = null;
let TOKEN: string;
let ASSIGNMENT: Assignment;

main();

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
        YMapMarker,
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

    function createMarker() {

        const markerElement = document.createElement("div");
        markerElement.classList.add("marker_container");

        markerElement.innerHTML = MARKER_IMAGE_SVG;

        return new YMapMarker(ROUTE.start, markerElement);
    }

    let animation: DriverAnimation;
    let lastChangedCoordinates: LngLat;
    let prevCoordinates: LngLat;
    let passedDistance = 0;

    const routeProgress = (coordinates: LngLat) => {

        // Initial values
        prevCoordinates ??= route.geometry.coordinates[0];
        lastChangedCoordinates ??= route.geometry.coordinates[0];

        // Calculate variables
        const slicedLine = lineSlice(
            lastChangedCoordinates,
            coordinates,
            route.geometry
        );

        let passedTime = 0;
        const animationDistance = length(slicedLine, { units: "meters" });
        const driverSpeed = animationDistance / ((ANIMATE_DURATION_MS - 10) / 1000);

        // Stop if distance is minimal
        if (animationDistance < 1) {
            return;
        }

        lastChangedCoordinates = coordinates;

        // Animation
        animation = animate((progress) => {

            // Variables
            const timeS = (progress * ANIMATE_DURATION_MS) / 1000;
            const currentLength = passedDistance + driverSpeed * (timeS - passedTime);

            // Next location
            const nextCoordinates = along(route.geometry, currentLength, {
                units: "meters",
            }).geometry.coordinates as LngLat;

            // Update coords
            marker.update({ coordinates: nextCoordinates });

            // Rotate
            if (
                prevCoordinates &&
                !booleanEqual(point(prevCoordinates), point(nextCoordinates))
            ) {
                rotateAngle(nextCoordinates);

            }

            // Line Progress
            const [newLineStingFirstPart, _] =
                splitLineString(route, nextCoordinates);
            lineStringFirstPart.update({ geometry: newLineStingFirstPart });

            // Calculate Distance
            var remainingDistance = roundTo(length(lineString(newLineStingFirstPart.coordinates)), 2);
            var distanceElement = document.getElementById("popup-distance");
            distanceElement.innerText = `${remainingDistance} km`

            // update vars
            prevCoordinates = nextCoordinates;
            passedDistance = currentLength;
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

    const lineStringFirstPart = new YMapFeature({
        geometry: { coordinates: [], type: "LineString" },
        style: ROUTE_STYLE,
    });

    map.addChild(new YMapDefaultMarker(ROUTE.end));

    var marker = createMarker();
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

        // pass if no change
        if (location == lastChangedCoordinates)
            return;

        if (isPointInLine(location)) {
            routeProgress(location);
        }
        else
        {
            route = await fetchRoute(
                lastChangedCoordinates,
                ROUTE.end.coordinates,
                location as any
            );
            passedDistance = 0;
            lastChangedCoordinates = null;
            prevCoordinates = null;

            // Route Progress
            routeProgress(location);
        }
        i++;
    }, ANIMATE_DURATION_MS);

    function rotateAngle(nextCoordinates: LngLat) {
        const angle = angleFromCoordinate(
            prevCoordinates,
            nextCoordinates
        );
        const markerElement = document.getElementById("marker");
        markerElement.style.transform = `rotate(${angle}deg)`;
    }

    function isPointInLine(coordinate: number[]) {
        const allowedErrorMetrs = 50;
        const nearestLinePoint = getNearestPointInLine(coordinate);

        const dist = nearestLinePoint.properties.dist;

        return allowedErrorMetrs > dist;
    }

    function getNearestPointInLine(coordinate: number[]) {
        const currentLine = lineString(route.geometry.coordinates);
        const nearestLinePoint = nearestPointOnLine(currentLine, point(coordinate), {
            units: "meters",
        });

        return nearestLinePoint;
    }

    let route = await fetchRoute(
        ROUTE.start.coordinates,
        ROUTE.end.coordinates
    );

    // Update the Coords
    marker.update({ coordinates: route.geometry.coordinates[0] })
    lineStringFirstPart.update({ geometry: route.geometry });
    map.addChild(lineStringFirstPart);

    // Rotate the angle
    prevCoordinates ??= route.geometry.coordinates[0];
    const nextCoordinates = along(route.geometry, 1, {
        units: "meters",
    }).geometry.coordinates as LngLat;
    rotateAngle(nextCoordinates);

    // Calculate Distance
    var remainingDistance = roundTo(length(lineString(lineStringFirstPart.geometry.coordinates as LngLat[])), 2);
    var distanceElement = document.getElementById("popup-distance");
    distanceElement.innerText = `${remainingDistance} km`
}

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
    ROUTE.start.subtitle = assignment.brigadePlateNumber;

    ROUTE.end.coordinates = [
        assignment.destinationLocation.longitude,
        assignment.destinationLocation.latitude,
    ];
    ROUTE.end.title = assignment.destinationFullAddressLine ?? "";
}

function roundTo(value: number, decimals: number): number {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

function fetchPopupContent(assignment: Assignment) {
    const popupContent = document.getElementById("popup-content");
    if (assignment && popupContent) {
        popupContent.innerHTML = `
  <div class='balloon' id="balloon">

  <p class="title">${assignment.nameRu}</p>
  <p class="description">${assignment.destinationFullAddressLine}</p>
  <p class="description">
  ${assignment.brigadePlateNumber ?? ""} <b id="popup-distance"> </b>
  </p>
  </div>
        `;
    }
}

async function getAssignments(token: string) {
    const params = new URLSearchParams();
    params.append("token", token);
    return fetch(
        `${BASE_URL}/brigade-tracking-service/api/brigade-tracking/assignments?${params.toString()}`
    );
}

async function getBrigadeLocation(id: string, token: string) {
    const params = new URLSearchParams();
    params.append("token", token);

    return fetch(
        `${BASE_URL}/brigade-tracking-service/api/brigade-tracking/brigade-location/${id}?${params.toString()}`
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
