import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Polyline, Circle } from 'react-leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet.heat';

// Fix for Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const center: [number, number] = [28.6139, 77.2090]; // Delhi default

interface MapProps {
  markers?: Array<{ 
    id: string; 
    lat: number; 
    lng: number; 
    label?: string; 
    description?: string;
    icon?: string;
    details?: React.ReactNode;
  }>;
  heatmapPoints?: Array<{ lat: number; lng: number; weight: number }>;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  zoom?: number;
  centerPos?: { lat: number; lng: number };
  path?: Array<[number, number]>;
  highDemandZones?: Array<{ lat: number; lng: number; count: number }>;
}

interface HeatmapLayerProps {
  points: Array<{ lat: number; lng: number; weight: number }>;
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    const data = points.map(p => [p.lat, p.lng, p.weight] as [number, number, number]);
    const heatLayer = (L as any).heatLayer(data, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
};

const MapEvents: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapRecenter: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
};

const MapComponent: React.FC<MapProps> = ({ 
  markers, 
  heatmapPoints, 
  onMarkerClick, 
  onMapClick, 
  zoom = 13,
  centerPos,
  path,
  highDemandZones 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const mapCenter = useMemo((): [number, number] => 
    centerPos ? [centerPos.lat, centerPos.lng] : center, 
  [centerPos]);

  return (
    <div className="w-full h-full relative z-0 dark-map">
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1000] bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full animate-pulse"></div>
              <Loader2 className="w-10 h-10 text-brand animate-spin relative z-10" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] animate-pulse">Initializing Vector Hub</span>
              <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Fetching Terrain Data...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.basemaps.cartocdn.com/dark_all/copyright">CartoDB</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => setIsLoading(false),
          }}
        />
        
        <MapRecenter center={mapCenter} />
        {onMapClick && <MapEvents onClick={onMapClick} />}

        {path && path.length > 1 && (
          <>
            {/* Outer Glow */}
            <Polyline 
              positions={path} 
              color="#3B82F6" 
              weight={10} 
              opacity={0.3}
              lineJoin="round"
              lineCap="round"
            />
            {/* Main Path (White Line like Rapido/Uber Navigation) */}
            <Polyline 
              positions={path} 
              color="#FFFFFF" 
              weight={5} 
              opacity={1}
              lineJoin="round"
              lineCap="round"
              className="route-line-main"
            />
          </>
        )}

        {highDemandZones?.map((zone, i) => (
          <React.Fragment key={`zone-${i}`}>
            <Circle 
              center={[zone.lat, zone.lng]} 
              radius={200}
              pathOptions={{ 
                fillColor: '#ef4444', 
                color: '#ef4444', 
                weight: 2, 
                opacity: 0.3, 
                fillOpacity: 0.1 
              }} 
            />
            <Circle 
              center={[zone.lat, zone.lng]} 
              radius={100}
              pathOptions={{ 
                fillColor: '#ef4444', 
                color: '#ef4444', 
                weight: 1, 
                opacity: 0.6, 
                fillOpacity: 0.4 
              }} 
            />
          </React.Fragment>
        ))}
        
        {markers?.map((marker) => {
          const isSellerMarker = marker.id.includes('seller') || marker.icon === 'brand' || marker.id === 'seller';
          const markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="relative flex items-center justify-center">
              ${isSellerMarker ? `
                <div class="absolute -inset-2 bg-brand/20 rounded-full animate-pulse"></div>
                <div class="w-10 h-10 rounded-full border-4 border-white shadow-[0_0_15px_rgba(255,184,0,0.4)] bg-brand flex items-center justify-center z-10 transition-transform scale-110">
                   <div class="w-4 h-4 bg-dark rounded-[2px] rotate-45 flex items-center justify-center overflow-hidden">
                      <div class="w-1 h-1 bg-white rounded-full"></div>
                   </div>
                </div>
              ` : `
                <div class="w-6 h-6 rounded-full border-3 border-white shadow-xl ${
                  marker.icon === 'green' ? 'bg-green-500' : 
                  marker.icon === 'yellow' ? 'bg-yellow-500' : 
                  'bg-brand'
                } flex items-center justify-center">
                   <div class="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
                </div>
              `}
            </div>`,
            iconSize: isSellerMarker ? [40, 40] : [24, 24],
            iconAnchor: isSellerMarker ? [20, 20] : [12, 12],
          });

          return (
            <Marker 
              key={marker.id} 
              position={[marker.lat, marker.lng]}
              icon={markerIcon}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(marker.id)
              }}
            >
              {(marker.label || marker.description || marker.details) && (
                <Popup className="premium-popup">
                  <div className="p-2 min-w-[120px] space-y-1">
                    {marker.label && (
                      <div className="font-black uppercase tracking-widest text-[10px] text-white">
                        {marker.label}
                      </div>
                    )}
                    {marker.description && (
                      <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight leading-tight">
                        {marker.description}
                      </div>
                    )}
                    {marker.details && (
                      <div className="mt-2 pt-2 border-t border-line">
                        {marker.details}
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}

        {heatmapPoints && heatmapPoints.length > 0 && (
          <HeatmapLayer points={heatmapPoints} />
        )}
      </MapContainer>
    </div>
  );
};

export default React.memo(MapComponent);
