import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, Polyline, Circle } from 'react-leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet.heat';
import { cn } from '../lib/utils';

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
    logoUrl?: string;
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

const MapRecenter: React.FC<{ center: [number, number], force?: boolean }> = ({ center, force }) => {
  const map = useMap();
  useEffect(() => {
    if (force) {
      map.setView(center, map.getZoom());
    }
  }, [center, map, force]);
  return null;
};

const MapAutoFit: React.FC<{ markers?: MapProps['markers'], path?: MapProps['path'] }> = ({ markers, path }) => {
  const map = useMap();
  
  useEffect(() => {
    if ((!markers || markers.length === 0) && (!path || path.length === 0)) return;

    const bounds = L.latLngBounds([]);
    
    // Add markers to bounds
    markers?.forEach(marker => {
      bounds.extend([marker.lat, marker.lng]);
    });

    // Add path to bounds
    path?.forEach(point => {
      bounds.extend(point);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { 
        padding: [30, 30], // More concise padding
        maxZoom: 16, 
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [map, markers, path]);

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
  const [forceRecenter, setForceRecenter] = useState(false); // Changed to false by default to let AutoFit handle initial view
  const mapCenter = useMemo((): [number, number] => 
    centerPos ? [centerPos.lat, centerPos.lng] : center, 
  [centerPos]);

  return (
    <div className="w-full h-full relative z-0">
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[1000] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          >
            <div className="relative">
              <Loader2 className="w-10 h-10 text-brand animate-spin relative z-10" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-brand uppercase tracking-[0.3em] animate-pulse">VegieRoute Radar</span>
              <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1">Fetching Terrain Data...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MapContainer 
        center={mapCenter} 
        zoom={zoom} 
        scrollWheelZoom={true}
        className="w-full h-full rounded-[24px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.basemaps.cartocdn.com/rastertiles/voyager/copyright">CartoDB</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          eventHandlers={{
            loading: () => setIsLoading(true),
            load: () => setIsLoading(false),
          }}
        />
        
        <MapRecenter center={mapCenter} force={forceRecenter} />
        <MapAutoFit markers={markers} path={path} />
        {onMapClick && <MapEvents onClick={onMapClick} />}

        {/* User Interaction Layer */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setForceRecenter(true);
              // Reset after small delay to allow manual panning again
              setTimeout(() => setForceRecenter(false), 500);
            }}
            className="w-10 h-10 bg-white rounded-xl shadow-xl flex items-center justify-center text-brand hover:bg-brand hover:text-white transition-all border border-gray-100"
            title="Snap to Live Location"
          >
            <Navigation className={cn("w-5 h-5", forceRecenter ? "animate-pulse" : "")} />
          </button>
        </div>

        {path && path.length > 1 && (
          <>
            {/* Outer Glow */}
            <Polyline 
              positions={path} 
              color="#22C55E" 
              weight={10} 
              opacity={0.2}
              lineJoin="round"
              lineCap="round"
            />
            {/* Main Path */}
            <Polyline 
              positions={path} 
              color="#22C55E" 
              weight={5} 
              opacity={0.8}
              lineJoin="round"
              lineCap="round"
            />
          </>
        )}

        {highDemandZones?.map((zone, i) => (
          <React.Fragment key={`zone-${i}`}>
            <Circle 
              center={[zone.lat, zone.lng]} 
              radius={200}
              pathOptions={{ 
                fillColor: '#22C55E', 
                color: '#22C55E', 
                weight: 2, 
                opacity: 0.2, 
                fillOpacity: 0.05 
              }} 
            />
          </React.Fragment>
        ))}
        
        {markers?.map((marker) => {
          const isSellerMarker = marker.id.includes('seller') || marker.icon === 'brand' || marker.id === 'seller';
          const isMeMarker = marker.id === 'me' || marker.id === 'selected';
          
          const markerIcon = L.divIcon({
            className: 'custom-div-icon-animate',
            html: `<div class="marker-pin-wrapper relative flex items-center justify-center transition-all duration-1000 ease-linear">
              ${isMeMarker ? `
                <div class="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping opacity-20"></div>
                <div class="absolute -inset-2 bg-blue-500/10 rounded-full"></div>
                <div class="w-6 h-6 rounded-full border-[3px] border-white shadow-xl bg-blue-500 flex items-center justify-center z-10">
                   <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
                </div>
              ` : isSellerMarker ? `
                <div class="absolute -inset-2 bg-brand/30 rounded-full animate-pulse"></div>
                <div class="w-10 h-10 rounded-full border-4 border-white shadow-xl bg-brand flex items-center justify-center z-10 transition-transform scale-110 overflow-hidden">
                   ${marker.logoUrl ? 
                     `<img src="${marker.logoUrl}" class="w-full h-full object-cover" />` : 
                     `<div class="w-1.5 h-1.5 bg-white rounded-full"></div>`
                   }
                </div>
              ` : `
                <div class="w-6 h-6 rounded-full border-[3px] border-white shadow-lg ${
                  marker.icon === 'green' ? 'bg-green-500' : 
                  marker.icon === 'yellow' ? 'bg-amber-500' : 
                  'bg-brand'
                } flex items-center justify-center">
                   <div class="w-1.5 h-1.5 bg-white/80 rounded-full"></div>
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
