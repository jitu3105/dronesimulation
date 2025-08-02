import React, { useEffect, useRef, useState } from "react";

import { Map, Marker, type MapRef } from "react-map-gl/maplibre";
import { Card } from "./components/ui/card";
import { Send } from "lucide-react";
const GameMap: React.FC<{ state: any }> = ({ state }) => {
  const mapRef = useRef<MapRef>(null);
  const [lngLat, setLngLat] = useState({ lat: 0, lng: 0 });
  useEffect(() => {
    const mapUpdater = async () => {
      if (state.current["heading"] && state.current["lat"] && mapRef.current) {
        const newLngLat = {
          lng: Number(state.current["lon"]),
          lat: Number(state.current["lat"]),
        };
        const bearing = mapRef.current.getBearing();
        setLngLat(newLngLat);
        if (!isNaN(bearing)) {
          mapRef.current.setBearing(state.current["heading"]);
          mapRef.current.setZoom(17 - (state.current["agl"] / 2000) * 17);
          mapRef.current.setCenter(newLngLat);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      animationId = requestAnimationFrame(mapUpdater);
    };
    let animationId = requestAnimationFrame(mapUpdater);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state]);

  return (
    <Card className="absolute w-full  sm:w-4/12 md:w-3/12 top-0 sm:top-4 right-0 sm:right-4 z-10  p-0  aspect-video overflow-hidden opacity-70 rounded-lg border-none pointer-events-none">
      <Map
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        initialViewState={{
          pitch: 90,
          // latitude: 40.67,
          // longitude: -103.59,
          zoom: 12,
        }}
        // mapStyle="https://tiles.stadiamaps.com/styles/alidade_dark.json"

        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        // interactiveLayerIds={[clusterLayer.id]}
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        // onClick={onClick}
      >
        <Marker latitude={lngLat.lat} longitude={lngLat.lng}>
          <Card className="bg-red-500 text-white p-1">📍</Card>
        </Marker>
      </Map>
      <Card className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-transparent shadow-none border-none">
        <Send size={30} color="red" fill="red" />
      </Card>
    </Card>
  );
};

export default GameMap;
