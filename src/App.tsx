
import React, { useEffect, useState, useRef, useMemo } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';

// --- Types ---
interface Flight {
    icao24: string;
    callsign: string;
    originCountry: string;
    longitude: number;
    latitude: number;
    altitude: number; // meters
    velocity: number; // m/s
    heading: number;  // degrees
    onGround: boolean;
}

interface RawFlightData {
    states: (string | number | boolean | null)[][];
    time: number;
}

// --- Constants ---
const EARTH_RADIUS_KM = 6371;


function App() {
    const globeEl = useRef<GlobeMethods | undefined>(undefined);
    const [flights, setFlights] = useState<Flight[]>([]);
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
    const [viewMode, setViewMode] = useState<'global' | 'cockpit'>('global');
    const [dimensions, setDimensions] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    // Handle Window Resize
    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchFlights = async () => {
            try {
                // Using proxy /api/flights
                const response = await fetch('/api/flights');
                if (!response.ok) {
                    console.error('API Error:', response.status);
                    return;
                }
                const data: RawFlightData = await response.json();

                if (!data.states) return;

                const parsedFlights: Flight[] = data.states.map((state) => ({
                    icao24: state[0] as string,
                    callsign: (state[1] as string).trim(),
                    originCountry: state[2] as string,
                    longitude: state[5] as number,
                    latitude: state[6] as number,
                    altitude: (state[7] as number) || 0,
                    onGround: state[8] as boolean,
                    velocity: (state[9] as number) || 0,
                    heading: (state[10] as number) || 0,
                })).filter(f => f.longitude != null && f.latitude != null && !f.onGround); // Filter grounded or invalid

                setFlights(parsedFlights);

                // Update selected flight if it exists in new data
                if (selectedFlight) {
                    const updated = parsedFlights.find(f => f.icao24 === selectedFlight.icao24);
                    if (updated) setSelectedFlight(updated);
                }

            } catch (error) {
                console.error('Fetch error:', error);
            }
        };

        fetchFlights();
        const interval = setInterval(fetchFlights, 15000); // 15s interval
        return () => clearInterval(interval);
    }, [selectedFlight]); // Dep on selectedFlight to keep it updated? specialized logic maybe better


    // --- Camera Logic for Cockpit/Follow Mode ---
    useEffect(() => {
        if (!globeEl.current) return;

        if (viewMode === 'cockpit' && selectedFlight) {
            // Simplified cockpit view: Just look at the plane from above/diagonal for now
            // "True" cockpit view requires custom camera manipulation,
            // but pointOfView is easier for "Follow" mode.

            globeEl.current.pointOfView({
                lat: selectedFlight.latitude,
                lng: selectedFlight.longitude,
                altitude: Math.max(0.05, selectedFlight.altitude / EARTH_RADIUS_KM * 20 + 0.1) // Zoomed in
            }, 1000);
        } else if (viewMode === 'global') {
            // Maybe auto-rotate?
            globeEl.current.controls().autoRotate = true;
            globeEl.current.controls().autoRotateSpeed = 0.5;
        }
    }, [selectedFlight, viewMode]);

    // --- 3D Object Rendering ---
    const getObjectThreeObject = useMemo(() => {
        return (d: object) => {
            const flight = d as Flight;
            // distinct color for selected
            const color = (selectedFlight?.icao24 === flight.icao24) ? '#ff003c' : '#00f3ff';

            // Simple Cone
            const geometry = new THREE.ConeGeometry(0.3, 1.2, 8); // Radius, Height, Segments
            geometry.rotateX(Math.PI / 2); // Point cone towards movement?
            // Globe objects are placed upright on the surface.
            // If we rotate X 90, it points along the surface tangent?
            // Actually, let's keep it simple. A mesh.

            const material = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0.9 });
            const mesh = new THREE.Mesh(geometry, material);

            // Scale by altitude? Or fixed size?
            // Visual size should be visible.

            return mesh;
        }
    }, [selectedFlight]);

    return (
        <div className="relative w-screen h-screen bg-cyber-dark overflow-hidden text-cyber-neon font-hud">
            <Globe
                ref={globeEl}
                width={dimensions.width}
                height={dimensions.height}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

                // Flight Objects
                objectsData={flights}
                objectLat="latitude"
                objectLng="longitude"
                objectAltitude={(d) => (d as Flight).altitude / 100000} // Exaggerate altitude?
                // Scale: 1 unit = Earth Radius.
                // Real: 10km / 6371km ~= 0.0015.
                // ReactGlobe uses altitude as multiplier of generic R=1?
                // documentation: "altitude in terms of globe radius units (0 = surface, 1 = radius high)"
                // 10km is 0.0015. Very close to surface.
                // Let's multiply by 5-10x for visibility.

                objectThreeObject={getObjectThreeObject}
                objectLabel={d => `${(d as Flight).callsign} (${(d as Flight).originCountry})`}

                // Orientation
                // We need to rotate the object based on heading.
                // objectThreeObject is called once per object instantiation.
                // We typically use objectOrientation to rotate? Or rotate the mesh in threeObject?
                onObjectClick={(obj) => {
                    setSelectedFlight(obj as Flight);
                    setViewMode('cockpit');
                }}
            />

            {/* --- UI Overlay --- */}

            {/* Header */}
            <div className="absolute top-4 left-4 p-4 border border-cyber-neon bg-cyber-dark/80 backdrop-blur-sm rounded-lg shadow-[0_0_15px_rgba(0,243,255,0.3)]">
                <h1 className="text-3xl font-bold tracking-wider mb-1">SKY-NET 3D</h1>
                <p className="text-xs text-cyber-dim uppercase tracking-widest">Global Live Flight Tracker</p>
                <div className="mt-2 text-sm">
                    <span className="text-white">Active Flights: </span>
                    <span className="font-bold">{flights.length}</span>
                </div>
            </div>

            {/* HUD (Bottom Right) */}
            {selectedFlight && (
                <div className="absolute bottom-4 right-4 w-80 border-2 border-cyber-neon bg-black/90 p-4 text-cyber-neon font-mono transform transition-all duration-300">
                    <div className="flex justify-between items-center mb-4 border-b border-cyber-dim pb-2">
                        <span className="text-xl font-bold">{selectedFlight.callsign || 'N/A'}</span>
                        <span className="text-xs bg-cyber-neon text-black px-2 py-1 rounded">{selectedFlight.icao24}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs uppercase">Altitude</p>
                            <p className="text-lg">{Math.round(selectedFlight.altitude)} m</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase">Velocity</p>
                            <p className="text-lg">{Math.round(selectedFlight.velocity * 3.6)} km/h</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase">Heading</p>
                            <p className="text-lg">{Math.round(selectedFlight.heading)}°</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase">Country</p>
                            <p className="text-lg truncate">{selectedFlight.originCountry}</p>
                        </div>
                    </div>

                    <button
                        className="mt-4 w-full border border-cyber-alert text-cyber-alert hover:bg-cyber-alert hover:text-white py-1 transition-colors uppercase text-xs tracking-widest"
                        onClick={() => {
                            setSelectedFlight(null);
                            setViewMode('global');
                        }}
                    >
                        Disengage
                    </button>
                </div>
            )}

            {/* Loading Indicator */}
            {flights.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="animate-pulse text-cyber-neon text-2xl tracking-[0.5em]">INITIALIZING SCAN...</div>
                </div>
            )}
        </div>
    );
}

export default App;
