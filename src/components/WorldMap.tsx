import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { feature } from "topojson-client";
import countriesTopology from "world-atlas/countries-110m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";
import type { CountryContext, InteractionArrow } from "../types/domain";

interface Props {
  countries: CountryContext[];
  interactions: InteractionArrow[];
  selectedCountryCode: string | null;
  onClearCountry: () => void;
  onSelectCountry: (country: CountryContext) => void;
}

type CountryFeature = Feature<Geometry, { name?: string }> & { id?: string | number };
type ArrowModel = InteractionArrow & {
  d: string;
  markerId: string;
};

const WIDTH = 1000;
const HEIGHT = 520;
const COUNTRY_ID_BY_CODE: Record<string, string> = {
  AUS: "036",
  CHN: "156",
  DEU: "276",
  USA: "840"
};

const CONTINENT_ANCHORS: Record<string, Record<"east" | "north" | "south" | "west", [number, number]>> = {
  Africa: {
    east: [51.0, 10.0],
    north: [10.0, 36.0],
    south: [19.0, -34.5],
    west: [-17.5, 14.5]
  },
  Asia: {
    east: [139.5, 35.8],
    north: [82.0, 55.0],
    south: [103.8, 1.3],
    west: [35.0, 34.5]
  },
  Europe: {
    east: [29.0, 45.0],
    north: [10.5, 59.8],
    south: [14.5, 37.5],
    west: [-9.5, 38.8]
  },
  "North America": {
    east: [-66.0, 44.0],
    north: [-96.0, 58.0],
    south: [-97.0, 25.5],
    west: [-124.5, 38.0]
  },
  Oceania: {
    east: [153.5, -28.0],
    north: [134.0, -12.5],
    south: [115.5, -34.5],
    west: [113.0, -23.5]
  },
  "South America": {
    east: [-35.0, -8.0],
    north: [-75.0, 10.5],
    south: [-71.0, -53.0],
    west: [-80.5, -12.0]
  }
};

const topology = countriesTopology as unknown as Topology;
const countryCollection = feature(
  topology,
  topology.objects.countries
) as unknown as FeatureCollection<Geometry, { name?: string }>;

const worldFeatures = countryCollection.features as CountryFeature[];
const projection = geoNaturalEarth1().fitExtent(
  [
    [18, 18],
    [WIDTH - 18, HEIGHT - 18]
  ],
  { type: "Sphere" }
);
const path = geoPath(projection);

function projectedPoint(country: CountryContext) {
  return projection(country.centroid) ?? [WIDTH / 2, HEIGHT / 2];
}

function featureCenter(mapFeature: CountryFeature | undefined, fallback: [number, number]) {
  if (!mapFeature) return fallback;
  const bounds = path.bounds(mapFeature as GeoPermissibleObjects);
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2] as [number, number];
}

function featureEdgeAnchor(
  mapFeature: CountryFeature | undefined,
  fallback: [number, number],
  toward: [number, number]
) {
  if (!mapFeature) return fallback;

  const bounds = path.bounds(mapFeature as GeoPermissibleObjects);
  const center = featureCenter(mapFeature, fallback);
  const dx = toward[0] - center[0];
  const dy = toward[1] - center[1];
  const halfWidth = Math.max(1, (bounds[1][0] - bounds[0][0]) / 2);
  const halfHeight = Math.max(1, (bounds[1][1] - bounds[0][1]) / 2);
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy)
  );
  if (!Number.isFinite(scale)) return center;

  return [center[0] + dx * scale * 0.92, center[1] + dy * scale * 0.92] as [number, number];
}

function continentAnchor(continent: string, toward: [number, number]) {
  const anchors = CONTINENT_ANCHORS[continent];
  if (!anchors) return null;

  const projectedAnchors = Object.entries(anchors)
    .map(([edge, lonLat]) => {
      const point = projection(lonLat);
      return point ? { edge, point } : null;
    })
    .filter((anchor): anchor is { edge: string; point: [number, number] } => anchor !== null);
  if (!projectedAnchors.length) return null;

  const center = projectedAnchors.reduce<[number, number]>(
    (total, anchor) => [total[0] + anchor.point[0], total[1] + anchor.point[1]],
    [0, 0]
  );
  center[0] /= projectedAnchors.length;
  center[1] /= projectedAnchors.length;

  const dx = toward[0] - center[0];
  const dy = toward[1] - center[1];
  const preferredEdge = Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0 ? "east" : "west"
    : dy >= 0 ? "south" : "north";

  return projectedAnchors.find((anchor) => anchor.edge === preferredEdge)?.point ?? null;
}

function arcPath(from: [number, number], to: [number, number], lift: number) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distance = Math.sqrt(dx * dx + dy * dy);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2 - Math.max(22, distance * lift);
  return `M ${from[0]} ${from[1]} Q ${midX} ${midY} ${to[0]} ${to[1]}`;
}

export function WorldMap({ countries, interactions, selectedCountryCode, onClearCountry, onSelectCountry }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);

  const countriesByCode = useMemo(
    () => new Map(countries.map((country) => [country.code, country])),
    [countries]
  );

  const visibleCountryIds = useMemo(
    () => new Set(countries.map((country) => COUNTRY_ID_BY_CODE[country.code]).filter(Boolean)),
    [countries]
  );

  const selectedCountryId = selectedCountryCode ? COUNTRY_ID_BY_CODE[selectedCountryCode] : null;

  const countryFeatureByCode = useMemo(() => {
    const entries = countries
      .map((country) => {
        const id = COUNTRY_ID_BY_CODE[country.code];
        const mapFeature = worldFeatures.find((item) => String(item.id) === id);
        return mapFeature ? ([country.code, mapFeature] as const) : null;
      })
      .filter(Boolean);
    return new Map(entries as [string, CountryFeature][]);
  }, [countries]);

  const arrowModels = useMemo(
    () =>
      interactions
        .map((interaction, index) => {
          const fromCountry = countriesByCode.get(interaction.from);
          const toCountry = countriesByCode.get(interaction.to);
          if (!fromCountry || !toCountry) return null;

          const fromFallback = projectedPoint(fromCountry);
          const toFallback = projectedPoint(toCountry);
          const fromFeature = countryFeatureByCode.get(fromCountry.code);
          const toFeature = countryFeatureByCode.get(toCountry.code);
          const fromCenter = featureCenter(fromFeature, fromFallback);
          const toCenter = featureCenter(toFeature, toFallback);
          const from = continentAnchor(fromCountry.continent, toCenter) ?? featureEdgeAnchor(fromFeature, fromFallback, toCenter);
          const to = continentAnchor(toCountry.continent, fromCenter) ?? featureEdgeAnchor(toFeature, toFallback, fromCenter);

          return {
            ...interaction,
            d: arcPath(from, to, index % 2 === 0 ? 0.12 : -0.09),
            markerId: `arrow-head-${interaction.id}`
          };
        })
        .filter((arrow): arrow is ArrowModel => arrow !== null),
    [countriesByCode, countryFeatureByCode, interactions]
  );

  const applyZoom = useCallback((nextTransform: ZoomTransform) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(420)
      .call(zoomRef.current.transform, nextTransform);
  }, []);

  const resetZoom = useCallback(() => {
    applyZoom(zoomIdentity);
  }, [applyZoom]);

  const focusCountry = useCallback(
    (country: CountryContext, immediate = false) => {
      const mapFeature = countryFeatureByCode.get(country.code);
      let center = projectedPoint(country);
      let scale = 3.2;

      if (mapFeature) {
        const bounds = path.bounds(mapFeature as GeoPermissibleObjects);
        const width = Math.max(1, bounds[1][0] - bounds[0][0]);
        const height = Math.max(1, bounds[1][1] - bounds[0][1]);
        center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
        scale = Math.min(8, Math.max(2.1, 0.72 / Math.max(width / WIDTH, height / HEIGHT)));
      }

      const nextTransform = zoomIdentity
        .translate(WIDTH * 0.38, HEIGHT / 2)
        .scale(scale)
        .translate(-center[0], -center[1]);

      if (immediate && svgRef.current && zoomRef.current) {
        select(svgRef.current).call(zoomRef.current.transform, nextTransform);
        return;
      }

      applyZoom(nextTransform);
    },
    [applyZoom, countryFeatureByCode]
  );

  useEffect(() => {
    if (!svgRef.current) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 9])
      .translateExtent([
        [-WIDTH * 0.25, -HEIGHT * 0.25],
        [WIDTH * 1.25, HEIGHT * 1.25]
      ])
      .extent([
        [0, 0],
        [WIDTH, HEIGHT]
      ])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    zoomRef.current = zoomBehavior;
    select(svgRef.current).call(zoomBehavior);

    return () => {
      select(svgRef.current).on(".zoom", null);
      zoomRef.current = null;
    };
  }, []);

  function selectCountry(country: CountryContext) {
    onSelectCountry(country);
    focusCountry(country);
  }

  function clearCountry() {
    onClearCountry();
    resetZoom();
  }

  function zoomBy(multiplier: number) {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).transition().duration(240).call(zoomRef.current.scaleBy, multiplier);
  }

  return (
    <section className="world-map" aria-label="World market map">
      <div className="map-toolbar" aria-label="Map controls">
        <button aria-label="Zoom in" onClick={() => zoomBy(1.35)} type="button">
          <Plus size={16} />
        </button>
        <button aria-label="Zoom out" onClick={() => zoomBy(0.74)} type="button">
          <Minus size={16} />
        </button>
        <button aria-label="Reset map view" onClick={resetZoom} type="button">
          <RotateCcw size={16} />
        </button>
      </div>
      <svg className="map-svg" ref={svgRef} role="img" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          {arrowModels.map((arrow) => (
            <marker
              className={`map-arrow-head map-arrow-head--${arrow.correlation}`}
              id={arrow.markerId}
              key={arrow.markerId}
              markerHeight="5"
              markerWidth="7"
              orient="auto"
              refX="6.4"
              refY="2.5"
              viewBox="0 0 7 5"
            >
              <path d="M 0 0 L 7 2.5 L 0 5 z" />
            </marker>
          ))}
        </defs>
        <rect className="map-ocean" height={HEIGHT} onClick={clearCountry} width={WIDTH} />
        <g className="map-viewport" transform={transform.toString()}>
          <g className="map-countries">
            {worldFeatures.map((mapFeature) => {
              const id = String(mapFeature.id);
              const linkedCountry = countries.find((country) => COUNTRY_ID_BY_CODE[country.code] === id);
              const isVisibleCountry = visibleCountryIds.has(id);
              const isSelected = id === selectedCountryId;
              const d = path(mapFeature as GeoPermissibleObjects);
              if (!d) return null;

              return (
                <path
                  aria-label={mapFeature.properties?.name ?? "Country"}
                  className={[
                    "map-country",
                    isVisibleCountry ? "map-country--available" : "",
                    isSelected ? "map-country--selected" : ""
                  ].join(" ")}
                  d={d}
                  key={id}
                  onClick={linkedCountry ? () => selectCountry(linkedCountry) : clearCountry}
                  role={linkedCountry ? "button" : "img"}
                  tabIndex={linkedCountry ? 0 : -1}
                />
              );
            })}
          </g>
          <g className="map-arrows">
            {arrowModels.map((arrow) => (
              <path
                className={`map-arrow map-arrow--${arrow.correlation}`}
                d={arrow.d}
                key={arrow.id}
                markerEnd={`url(#${arrow.markerId})`}
              >
                <title>{arrow.label}</title>
              </path>
            ))}
          </g>
          <g className="map-pins">
            {countries.map((country) => {
              const [x, y] = projectedPoint(country);
              return (
                <g
                  aria-label={`Select ${country.name}`}
                  className={`country-marker ${selectedCountryCode === country.code ? "country-marker--active" : ""}`}
                  key={country.code}
                  onClick={() => selectCountry(country)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectCountry(country);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  transform={`translate(${x} ${y}) scale(${1 / transform.k})`}
                >
                  <circle r="14" />
                  <text dy="4">{country.code}</text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </section>
  );
}
