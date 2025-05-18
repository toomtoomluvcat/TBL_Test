'use client';

import { useEffect, useRef, useState } from 'react';
import { MapIcon, MapPinIcon, ArchiveBoxXMarkIcon, TruckIcon, PlusCircleIcon, ArrowPathIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function MapWithDirections() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [originPosition, setOriginPosition] = useState(null);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [selectionMode, setSelectionMode] = useState('origin'); // 'origin', 'destination', 'waypoint'
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [markers, setMarkers] = useState([]); // เพิ่ม state สำหรับเก็บ markers
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [markerStyles, setMarkerStyles] = useState(null);

  // เพิ่มอาเรย์สีสำหรับ markers
  const markerColors = [
    'red',     // สีแดง
    'blue',    // สีน้ำเงิน
    'green',   // สีเขียว
    'yellow',  // สีเหลือง
    'purple',  // สีม่วง
    'orange',  // สีส้ม
    'pink',    // สีชมพู
    'brown',   // สีน้ำตาล
  ];

  // ฟังก์ชันสำหรับสร้าง marker
  const createMarker = (position, type) => {
    if (!map || !markerStyles) return null;
    
    const style = markerStyles[type];
    const marker = new window.google.maps.Marker({
      position,
      map,
      draggable: true,
      title: style.label,
      icon: style.icon
    });

    // เพิ่ม event listener สำหรับการลาก marker
    marker.addListener('dragend', () => {
      const newPos = marker.getPosition();
      if (type === 'origin') {
        setOriginPosition(newPos);
      } else if (type === 'destination') {
        setDestinationPosition(newPos);
      } else if (type === 'waypoint') {
        setWaypoints(prev => prev.map(wp => 
          wp.marker === marker ? { ...wp, location: newPos } : wp
        ));
      }
      updateRoute();
    });

    return marker;
  };

  useEffect(() => {
    const loadGoogleMapsScript = () => {
      return new Promise((resolve) => {
        if (window.google && window.google.maps) {
          resolve(true);
          return;
        }

        window.initMap = () => resolve(true);

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBz4tJlygPDZeTb6_pPnt5IhdPuJcURPl8&libraries=places&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      });
    };

    loadGoogleMapsScript().then(() => {
      const center = { lat: 13.736717, lng: 100.523186 }; // กรุงเทพมหานคร

      const mapInstance = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }],
          },
        ],
      });

      const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
        map: mapInstance,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });

      // กำหนดสีสำหรับแต่ละประเภทของจุด หลังจาก Google Maps API โหลดเสร็จ
      const styles = {
        origin: {
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#22C55E', // สีเขียว
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white',
          },
          label: 'จุดเริ่มต้น'
        },
        destination: {
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#EF4444', // สีแดง
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white',
          },
          label: 'จุดปลายทาง'
        },
        waypoint: {
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#3B82F6', // สีน้ำเงิน
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white',
          },
          label: 'จุดแวะ'
        }
      };

      setMap(mapInstance);
      setDirectionsRenderer(directionsRendererInstance);
      setMarkerStyles(styles);
    });

    return () => {
      delete window.initMap;
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('click', (e) => {
      const location = e.latLng;

      if (selectionMode === 'origin') {
        if (originMarker) {
          originMarker.setMap(null);
        }
        const marker = createMarker(location, 'origin');
        setOriginMarker(marker);
        setOriginPosition(location);
        setSelectionMode('destination');
      } else if (selectionMode === 'destination') {
        if (destinationMarker) {
          destinationMarker.setMap(null);
        }
        const marker = createMarker(location, 'destination');
        setDestinationMarker(marker);
        setDestinationPosition(location);
        setSelectionMode('waypoint');
      } else if (selectionMode === 'waypoint') {
        const marker = createMarker(location, 'waypoint');
        if (marker) {
          setWaypoints(prev => [...prev, { location, marker }]);
        }
      }

      if (originPosition && destinationPosition) {
        updateRoute();
      }
    });

    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [map, selectionMode, originPosition, destinationPosition]);

  // เพิ่ม useEffect สำหรับจัดการ cleanup markers
  useEffect(() => {
    return () => {
      markers.forEach(marker => marker.setMap(null));
    };
  }, [markers]);

  // แสดงเส้นทางรวมทั้งหมด
  const updateRoute = () => {
    if (!originPosition || !destinationPosition) return;

    const directionsService = new window.google.maps.DirectionsService();
    const request = {
      origin: originPosition,
      destination: destinationPosition,
      waypoints: waypoints.map(wp => ({
        location: wp.location,
        stopover: true
      })),
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: true
    };

    directionsService.route(request, (result, status) => {
      if (status === 'OK' && directionsRenderer) {
        directionsRenderer.setOptions({ suppressMarkers: true });
        directionsRenderer.setDirections(result);
      }
    });
  };

  // คำนวณเวลาเดินทางแยกทีละช่วง
  const calculateTrafficTimes = async () => {
    if (!originPosition || !destinationPosition) return null;

    const directionsService = new window.google.maps.DirectionsService();
    let segments = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let totalDurationInTraffic = 0;
    let maxTrafficRatio = 0;
    let trafficStatus = 'ปกติ';

    try {
      // สร้างจุดทั้งหมดที่ต้องคำนวณ
      const points = [originPosition, ...waypoints.map(wp => wp.location), destinationPosition];

      // คำนวณทีละช่วง
      for (let i = 0; i < points.length - 1; i++) {
        // รอ 1 วินาทีระหว่างแต่ละ request เพื่อให้ได้ข้อมูลจราจรที่แม่นยำ
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const segmentRequest = {
          origin: points[i],
          destination: points[i + 1],
          travelMode: window.google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: new Date(),
            trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
          }
        };

        const segmentResult = await new Promise((resolve, reject) => {
          directionsService.route(segmentRequest, (res, status) => {
            if (status === 'OK') resolve(res);
            else reject(new Error(`เกิดข้อผิดพลาดในการค้นหาเส้นทางช่วงที่ ${i + 1}: ${status}`));
          });
        });

        const leg = segmentResult.routes[0].legs[0];
        const segmentDistance = leg.distance.value;
        const segmentDuration = leg.duration.value;
        const segmentDurationInTraffic = leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value;
        const segmentTrafficRatio = segmentDurationInTraffic / segmentDuration;

        totalDistance += segmentDistance;
        totalDuration += segmentDuration;
        totalDurationInTraffic += segmentDurationInTraffic;
        maxTrafficRatio = Math.max(maxTrafficRatio, segmentTrafficRatio);

        const segment = {
          start: leg.start_address,
          end: leg.end_address,
          distance: leg.distance.text,
          normalDuration: leg.duration.text,
          trafficDuration: leg.duration_in_traffic ? leg.duration_in_traffic.text : leg.duration.text,
          trafficRatio: segmentTrafficRatio,
          type: i === 0 ? 'origin' : i === points.length - 2 ? 'destination' : 'waypoint'
        };

        segments.push(segment);

        // แสดงสีของเส้นทางตามสภาพจราจร
        if (segmentTrafficRatio > 1.2) {
          new window.google.maps.Polyline({
            path: segmentResult.routes[0].overview_path,
            map: map,
            strokeColor: segmentTrafficRatio >= 2.0 ? '#EF4444' : // สีแดง
                        segmentTrafficRatio >= 1.5 ? '#F97316' : // สีส้ม
                        '#EAB308', // สีเหลือง
            strokeWeight: 4,
            strokeOpacity: 0.7,
            zIndex: 1
          });
        }
      }

      // กำหนดสถานะการจราจรจากค่าสูงสุด
      if (maxTrafficRatio >= 2.0) {
        trafficStatus = 'การจราจรติดขัดมาก';
      } else if (maxTrafficRatio >= 1.5) {
        trafficStatus = 'การจราจรติดขัด';
      } else if (maxTrafficRatio >= 1.2) {
        trafficStatus = 'การจราจรหนาแน่น';
      }

      return {
        distance: (totalDistance / 1000).toFixed(2) + ' กม.',
        duration: formatDuration(totalDuration),
        durationInTraffic: formatDuration(totalDurationInTraffic),
        segments: segments,
        trafficStatus: trafficStatus,
        trafficSeverity: maxTrafficRatio
      };
    } catch (error) {
      throw new Error(`ไม่สามารถคำนวณเส้นทางได้: ${error.message}`);
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours > 0 ? `${hours} ชม. ` : ''}${minutes} นาที`;
  };

  const calculateRoute = async () => {
    if (!originPosition || !destinationPosition) {
      alert('โปรดเลือกทั้งจุดเริ่มต้นและปลายทาง');
      return;
    }

    setLoading(true);
    
    try {
      // แสดงเส้นทางรวมก่อน
      updateRoute();
      
      // จากนั้นคำนวณเวลาเดินทางแยกทีละช่วง
      const result = await calculateTrafficTimes();
      if (result) {
        setRouteInfo(result);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // แก้ไขฟังก์ชัน removeWaypoint
  const removeWaypoint = (index) => {
    const removedWaypoint = waypoints[index];
    if (removedWaypoint.marker) {
      removedWaypoint.marker.setMap(null);
    }
    setWaypoints(prev => prev.filter((_, i) => i !== index));
    updateRoute();
  };

  // แก้ไขฟังก์ชัน resetAll
  const resetAll = () => {
    if (originMarker) {
      originMarker.setMap(null);
      setOriginMarker(null);
    }
    if (destinationMarker) {
      destinationMarker.setMap(null);
      setDestinationMarker(null);
    }
    setOriginPosition(null);
    setDestinationPosition(null);
    waypoints.forEach(wp => {
      if (wp.marker) {
        wp.marker.setMap(null);
      }
    });
    setWaypoints([]);
    setSelectionMode('origin');
    setRouteInfo(null);
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }
  };

  const formatLatLng = (latLng) => {
    if (!latLng) return 'ยังไม่ได้เลือก';
    return `${latLng.lat().toFixed(6)}, ${latLng.lng().toFixed(6)}`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
      {/* Panel ด้านซ้าย - ปรับให้แสดงด้านบนในหน้าจอเล็ก */}
      <div className="w-full lg:w-1/3 h-[60vh] lg:h-screen p-3 lg:p-6 bg-white shadow-lg overflow-y-auto">
        <div className="space-y-3 lg:space-y-6">
          {/* หัวข้อ */}
          <div className="flex items-center space-x-2 lg:space-x-3">
            <TruckIcon className="h-5 w-5 lg:h-8 lg:w-8 text-blue-600" />
            <h1 className="text-lg lg:text-2xl font-bold text-gray-800">ระบบนำทางอัจฉริยะ</h1>
          </div>

          {/* คำแนะนำการใช้งาน - แสดงในทุกขนาดหน้าจอแต่ปรับขนาด */}
          <div className="bg-blue-50 p-3 lg:p-4 rounded-lg border border-blue-100">
            <h2 className="text-xs lg:text-sm font-semibold text-blue-800 mb-1 lg:mb-2">วิธีใช้งาน</h2>
            <ol className="text-xs lg:text-sm text-blue-700 space-y-0.5 lg:space-y-1 list-decimal list-inside">
              <li>เลือกจุดเริ่มต้นบนแผนที่</li>
              <li>เลือกจุดปลายทาง</li>
              <li>เพิ่มจุดแวะตามต้องการ (ไม่บังคับ)</li>
              <li>กดปุ่มคำนวณเส้นทางเพื่อดูผลลัพธ์</li>
            </ol>
          </div>

          {/* ปุ่มเลือกโหมด */}
          <div className="space-y-2 lg:space-y-3">
            <h2 className="text-base lg:text-lg font-semibold text-gray-800">เลือกจุดบนแผนที่</h2>
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 lg:gap-3">
              <button
                className={`flex items-center p-2 lg:p-4 rounded-lg transition-all transform hover:scale-[1.02] ${
                  selectionMode === 'origin'
                    ? 'bg-green-100 text-green-700 border-2 border-green-200 shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectionMode('origin')}
              >
                <MapPinIcon className={`h-4 w-4 lg:h-6 lg:w-6 mr-1.5 lg:mr-3 ${selectionMode === 'origin' ? 'text-green-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className="font-medium text-xs lg:text-base">จุดเริ่มต้น</div>
                  <div className="text-[10px] lg:text-sm opacity-75 hidden lg:block">คลิกที่แผนที่เพื่อเลือกจุดเริ่มต้น</div>
                </div>
              </button>

              <button
                className={`flex items-center p-2 lg:p-4 rounded-lg transition-all transform hover:scale-[1.02] ${
                  selectionMode === 'destination'
                    ? 'bg-red-100 text-red-700 border-2 border-red-200 shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectionMode('destination')}
              >
                <MapIcon className={`h-4 w-4 lg:h-6 lg:w-6 mr-1.5 lg:mr-3 ${selectionMode === 'destination' ? 'text-red-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className="font-medium text-xs lg:text-base">จุดปลายทาง</div>
                  <div className="text-[10px] lg:text-sm opacity-75 hidden lg:block">คลิกที่แผนที่เพื่อเลือกจุดปลายทาง</div>
                </div>
              </button>

              <button
                className={`flex items-center p-2 lg:p-4 rounded-lg transition-all transform hover:scale-[1.02] ${
                  selectionMode === 'waypoint'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-200 shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectionMode('waypoint')}
              >
                <PlusCircleIcon className={`h-4 w-4 lg:h-6 lg:w-6 mr-1.5 lg:mr-3 ${selectionMode === 'waypoint' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className="font-medium text-xs lg:text-base">จุดแวะ</div>
                  <div className="text-[10px] lg:text-sm opacity-75 hidden lg:block">คลิกที่แผนที่เพื่อเพิ่มจุดแวะ</div>
                </div>
              </button>
            </div>
          </div>

          {/* แสดงพิกัดที่เลือก */}
          <div className="space-y-2 lg:space-y-4">
            <h2 className="text-base lg:text-lg font-semibold text-gray-800">พิกัดที่เลือก</h2>
            
            <div className="space-y-2 lg:space-y-3">
              {/* จุดเริ่มต้น */}
              <div className={`p-2 lg:p-4 rounded-lg border ${
                originPosition 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center mb-0.5 lg:mb-2">
                  <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-green-500 mr-1.5 lg:mr-2" />
                  <span className="font-medium text-xs lg:text-base text-gray-700">จุดเริ่มต้น</span>
                </div>
                <p className={`text-[10px] lg:text-sm ${originPosition ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                  {formatLatLng(originPosition)}
                </p>
              </div>

              {/* จุดปลายทาง */}
              <div className={`p-2 lg:p-4 rounded-lg border ${
                destinationPosition 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center mb-0.5 lg:mb-2">
                  <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-red-500 mr-1.5 lg:mr-2" />
                  <span className="font-medium text-xs lg:text-base text-gray-700">จุดปลายทาง</span>
                </div>
                <p className={`text-[10px] lg:text-sm ${destinationPosition ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                  {formatLatLng(destinationPosition)}
                </p>
              </div>

              {/* จุดแวะ */}
              {waypoints.length > 0 && (
                <div className="p-2 lg:p-4 rounded-lg border border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-between mb-1.5 lg:mb-3">
                    <div className="flex items-center">
                      <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-blue-500 mr-1.5 lg:mr-2" />
                      <span className="font-medium text-xs lg:text-base text-gray-700">จุดแวะ ({waypoints.length})</span>
                    </div>
                  </div>
                  <div className="space-y-1 lg:space-y-2">
                    {waypoints.map((wp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-1.5 lg:p-2 bg-white rounded border border-blue-100">
                        <span className="text-[10px] lg:text-sm text-gray-600">{formatLatLng(wp.location)}</span>
                        <button
                          onClick={() => removeWaypoint(idx)}
                          className="p-0.5 lg:p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                        >
                          <XCircleIcon className="h-3.5 w-3.5 lg:h-5 lg:w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ปุ่มดำเนินการ */}
          <div className="flex space-x-2 pt-3 lg:pt-4">
            <button
              className={`flex-1 flex items-center justify-center p-2 lg:p-4 rounded-lg font-semibold transition-all transform hover:scale-[1.02] ${
                loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
              }`}
              onClick={calculateRoute}
              disabled={loading}
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-3.5 w-3.5 lg:h-5 lg:w-5 mr-1.5 lg:mr-2 animate-spin" />
                  <span className="text-xs lg:text-base">กำลังคำนวณ...</span>
                </>
              ) : (
                <>
                  <TruckIcon className="h-3.5 w-3.5 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
                  <span className="text-xs lg:text-base">คำนวณเส้นทาง</span>
                </>
              )}
            </button>

            <button
              className="flex-1 flex items-center justify-center p-2 lg:p-4 rounded-lg font-semibold transition-all transform hover:scale-[1.02] bg-gray-100 text-gray-600 hover:bg-gray-200"
              onClick={resetAll}
            >
              <ArchiveBoxXMarkIcon className="h-3.5 w-3.5 lg:h-5 lg:w-5 mr-1.5 lg:mr-2" />
              <span className="text-xs lg:text-base">รีเซ็ต</span>
            </button>
          </div>

          {/* แสดงผลลัพธ์ */}
          {routeInfo && (
            <div className="space-y-3 lg:space-y-4 pt-3 lg:pt-4 border-t border-gray-200">
              <h2 className="text-base lg:text-lg font-semibold text-gray-800">ผลลัพธ์การค้นหาเส้นทาง</h2>
              
              {/* สรุปภาพรวม */}
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                <div className="p-2 lg:p-4 bg-gray-50 rounded-lg">
                  <div className="text-[10px] lg:text-sm text-gray-500">ระยะทางรวม</div>
                  <div className="text-xs lg:text-lg font-semibold text-gray-800">{routeInfo.distance}</div>
                </div>
                <div className="p-2 lg:p-4 bg-gray-50 rounded-lg">
                  <div className="text-[10px] lg:text-sm text-gray-500">เวลาเดินทาง</div>
                  <div className="text-xs lg:text-lg font-semibold text-gray-800">{routeInfo.durationInTraffic}</div>
                </div>
              </div>

              {/* สภาพการจราจร */}
              <div className={`p-2 lg:p-4 rounded-lg ${
                routeInfo.trafficSeverity >= 2.0 ? 'bg-red-50 text-red-700' :
                routeInfo.trafficSeverity >= 1.5 ? 'bg-orange-50 text-orange-700' :
                routeInfo.trafficSeverity >= 1.2 ? 'bg-yellow-50 text-yellow-700' :
                'bg-green-50 text-green-700'
              }`}>
                <div className="font-medium text-xs lg:text-base mb-0.5 lg:mb-1">สภาพการจราจร</div>
                <div className="text-[10px] lg:text-sm">{routeInfo.trafficStatus}</div>
              </div>

              {/* รายละเอียดแต่ละช่วง */}
              <div className="space-y-2 lg:space-y-3">
                <h3 className="text-xs lg:text-md font-medium text-gray-700">รายละเอียดแต่ละช่วง</h3>
                {routeInfo.segments.map((segment, idx) => (
                  <div key={idx} className="p-2 lg:p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5 lg:mb-2">
                      <div className="flex items-center">
                        <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full mr-1.5 lg:mr-2 ${
                          segment.type === 'origin' ? 'bg-green-500' :
                          segment.type === 'destination' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`} />
                        <span className="font-medium text-xs lg:text-base text-gray-700">ช่วงที่ {idx + 1}</span>
                      </div>
                      <span className={`px-1.5 lg:px-3 py-0.5 lg:py-1 rounded-full text-[10px] lg:text-xs font-medium ${
                        segment.trafficRatio >= 2.0 ? 'bg-red-100 text-red-700' :
                        segment.trafficRatio >= 1.5 ? 'bg-orange-100 text-orange-700' :
                        segment.trafficRatio >= 1.2 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {segment.trafficRatio >= 2.0 ? 'ติดขัดมาก' :
                         segment.trafficRatio >= 1.5 ? 'ติดขัด' :
                         segment.trafficRatio >= 1.2 ? 'หนาแน่น' : 'ปกติ'}
                      </span>
                    </div>
                    <div className="space-y-0.5 lg:space-y-1 text-[10px] lg:text-sm text-gray-600">
                      <p>จาก: {segment.start}</p>
                      <p>ถึง: {segment.end}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1 lg:gap-2 mt-1.5 lg:mt-3 text-[10px] lg:text-xs">
                      <div className="p-1 lg:p-2 bg-gray-50 rounded">
                        <div className="text-gray-500">ระยะทาง</div>
                        <div className="font-medium text-gray-700">{segment.distance}</div>
                      </div>
                      <div className="p-1 lg:p-2 bg-gray-50 rounded">
                        <div className="text-gray-500">เวลาปกติ</div>
                        <div className="font-medium text-gray-700">{segment.normalDuration}</div>
                      </div>
                      <div className="p-1 lg:p-2 bg-gray-50 rounded">
                        <div className="text-gray-500">เวลาจริง</div>
                        <div className="font-medium text-gray-700">{segment.trafficDuration}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* แผนที่ - ปรับความสูงตามหน้าจอ */}
      <div className="flex-1 h-[40vh] lg:h-screen relative">
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </div>
  );
} 