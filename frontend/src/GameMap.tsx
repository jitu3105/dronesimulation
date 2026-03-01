import React, { useEffect, useRef, useState } from "react";
import { Map, Marker, type MapRef } from "react-map-gl/maplibre";
import { Card } from "./components/ui/card";

const GameMap: React.FC<{ state: any }> = ({ state }) => {
  const mapRef = useRef<MapRef>(null);

  const [position, setPosition] = useState({
    lat: 0,
    lng: 0,
  });

  useEffect(() => {
    let animationId: number;

    const mapUpdater = () => {
      const current = state.current;

      if (
        current?.lat !== undefined &&
        current?.lon !== undefined &&
        mapRef.current
      ) {
        const newLngLat = {
          lng: Number(current.lon),
          lat: Number(current.lat),
        };

        if (!isNaN(newLngLat.lat) && !isNaN(newLngLat.lng)) {
          setPosition(newLngLat);

          const map = mapRef.current;

          // Center map on drone
          map.setCenter(newLngLat);

          // Rotate map instead of marker (GTA style)
          if (!isNaN(current.heading)) {
            map.setBearing(current.heading);
          }

          // Smooth zoom based on AGL
          const agl = Number(current.agl) || 0;
          const zoom = Math.max(12, Math.min(18, 18 - agl / 150));
          map.setZoom(zoom);
        }
      }

      animationId = requestAnimationFrame(mapUpdater);
    };

    animationId = requestAnimationFrame(mapUpdater);

    return () => cancelAnimationFrame(animationId);
  }, [state]);

  return (
    <Card
      className="
        absolute
        bottom-16
        left-1/2
        -translate-x-1/2
        w-[140px] h-[140px]
        sm:w-[180px] sm:h-[180px]
        md:w-[220px] md:h-[220px]
        bg-black/70
        backdrop-blur-md
        rounded-full
        border-4 border-white/20
        shadow-2xl
        overflow-hidden
        z-20
        pointer-events-none
      "
    >
      <Map
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        initialViewState={{
          latitude: 0,
          longitude: 0,
          zoom: 14,
          pitch: 0,
          bearing: 0,
        }}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        attributionControl={false}
        interactive={false}
      />

      {/* inner ring */}
      <div className="absolute inset-0 rounded-full border border-white/10" />

      {/* center arrow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="
            w-0 h-0
            border-l-[8px] border-l-transparent
            border-r-[8px] border-r-transparent
            border-b-[16px] border-b-red-500
          "
        />
      </div>
    </Card>
  );
};

export default GameMap;
