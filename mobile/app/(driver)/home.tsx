import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  TextInput,
  ActivityIndicator,
  StatusBar,
  Keyboard,
  FlatList,
  ScrollView,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import type { Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography } from "../../src/constants/theme";
import { api, vehicleTypeApi } from "../../src/services/api";
import { PricingPlan, AvailableSlot } from "../../src/types/facility.types";

// ─── Constants ────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BOTTOM_SHEET_HEIGHT = 420;
const ASPECT_RATIO = SCREEN_WIDTH / SCREEN_HEIGHT;

// Modern UI colors — Smart Parking brand palette
const UI = {
  textDark: "#14161C",
  textMedium: "#4A4A4A",
  textLight: "#6B7260",
  textMuted: "#9AA0A6",
  cardBg: "#FFFFFF",
  searchBg: "#FFFFFF",
  shadow: "#14161C",
  accentGreen: "#A4FF07",
  accentGreenDark: "#14161C",
  accentGreenLight: "#C4FF5A",
};

// Default region: Quận 1, TP.HCM
const INITIAL_REGION: Region = {
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035 * ASPECT_RATIO,
};

// ─── Types ────────────────────────────────────────────
interface ParkingLot {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  availableSlots: number;
  openTime: string;
  closeTime: string;
  distance?: string;
  description?: string;
  status: string;
  slotsByType: AvailableSlot[];
  pricing: PricingPlan[];
}

// ─── Vehicle Icon Helper ─────────────────────────────
const getVehicleIcon = (code?: string): keyof typeof Ionicons.glyphMap => {
  if (!code) return "bicycle";
  const u = code.toUpperCase();
  if (u.includes("CAR")) return "car-sport";
  if (u.includes("BUS")) return "bus";
  if (u.includes("TRUCK")) return "car";
  if (u.includes("MOTO")) return "bicycle";
  return "bicycle";
};

// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  SLOT AVAILABILITY BADGE
// ═══════════════════════════════════════════════════════
function SlotBadge({ available }: { available: number }) {
  const color =
    available === 0
      ? Colors.danger
      : available <= 10
        ? Colors.warning
        : Colors.success;
  const bgColor =
    available === 0
      ? Colors.dangerLight
      : available <= 10
        ? Colors.warningLight
        : Colors.successLight;
  const label = available === 0 ? "Hết chỗ" : `${available} chỗ trống`;

  return (
    <View style={[styles.slotBadge, { backgroundColor: bgColor }]}>
      <View style={[styles.slotDot, { backgroundColor: color }]} />
      <Text style={[styles.slotBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
//  SEARCH SUGGESTION ITEM
// ═══════════════════════════════════════════════════════
function SearchSuggestionItem({
  lot,
  onPress,
  distanceText,
}: {
  lot: ParkingLot;
  onPress: () => void;
  distanceText?: string;
}) {
  const slotColor =
    lot.availableSlots === 0
      ? Colors.danger
      : lot.availableSlots <= 10
        ? Colors.warning
        : Colors.success;

  const isOpen = (() => {
    if (lot.status !== "active") return false;
    if (!lot.openTime || !lot.closeTime) return true;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = lot.openTime.split(":").map(Number);
    const [closeH, closeM] = lot.closeTime.split(":").map(Number);
    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;
    if (closeMins <= openMins)
      return nowMins >= openMins || nowMins < closeMins;
    return nowMins >= openMins && nowMins < closeMins;
  })();

  return (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.suggestionIcon}>
        <Ionicons name="business" size={18} color={UI.accentGreenDark} />
      </View>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {lot.name}
        </Text>
        <View style={styles.suggestionMeta}>
          <Text style={styles.suggestionAddress} numberOfLines={1}>
            {lot.address}
          </Text>
          <View style={styles.suggestionMetaRow}>
            {distanceText ? (
              <View style={styles.suggestionMetaChip}>
                <Ionicons
                  name="navigate-outline"
                  size={11}
                  color={UI.textLight}
                />
                <Text style={styles.suggestionMetaText}>{distanceText}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.suggestionStatusDot,
                { backgroundColor: isOpen ? Colors.success : Colors.danger },
              ]}
            />
            <Text
              style={[
                styles.suggestionMetaText,
                { color: isOpen ? Colors.success : Colors.danger },
              ]}
            >
              {isOpen ? "Đang mở" : "Đóng cửa"}
            </Text>
          </View>
        </View>
      </View>
      <View
        style={[
          styles.suggestionSlotBadge,
          { backgroundColor: slotColor + "18" },
        ]}
      >
        <Text style={[styles.suggestionSlotText, { color: slotColor }]}>
          {lot.availableSlots === 0 ? "Hết" : lot.availableSlots}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN HOME SCREEN
// ═══════════════════════════════════════════════════════
export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);

  // State
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [allFacilities, setAllFacilities] = useState<ParkingLot[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("all");

  // Bottom Sheet animation
  const bottomSheetAnim = useRef(
    new Animated.Value(BOTTOM_SHEET_HEIGHT + 50),
  ).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // ─── Current map region (for zoom controls) ────────
  const currentRegionRef = useRef<Region>(INITIAL_REGION);

  // ─── Fetch facilities from API (coordinates from backend GeoJSON) ──
  const fetchFacilities = async () => {
    setDataLoading(true);
    try {
      const facilities = await api.getPublicFacilities(1, 50, "", "all");
      console.log(
        "[HOME] Fetched facilities count:",
        Array.isArray(facilities) ? facilities.length : "NOT_ARRAY",
        facilities,
      );

      // Ensure we have an array
      const facilityList = Array.isArray(facilities) ? facilities : [];

      // Map facilities to ParkingLot — use coordinates from GeoJSON location
      const lotsWithCoords: ParkingLot[] = [];
      const allLots: ParkingLot[] = [];

      await Promise.all(
        facilityList.map(async (f: any) => {
          // Extract coordinates from GeoJSON: [longitude, latitude]
          const coords = f.location?.coordinates;
          const lng = coords?.[0] ?? 0;
          const lat = coords?.[1] ?? 0;

          console.log(`[HOME] Facility "${f.name}": coords=[${lng}, ${lat}]`);

          // Fetch available slots count
          let availableSlots = 0;
          let slotsByType: AvailableSlot[] = [];
          try {
            const slotsData = await api.getAvailableSlots(f._id);
            slotsByType = slotsData;
            availableSlots = slotsData.reduce(
              (sum: number, s: any) => sum + s.availableCount,
              0,
            );
          } catch {}

          const lot: ParkingLot = {
            id: f._id,
            name: f.name,
            address: f.address,
            latitude: lat,
            longitude: lng,
            availableSlots,
            openTime: f.openTime || "06:00",
            closeTime: f.closeTime || "22:00",
            description: f.description || "",
            status: f.status || "active",
            slotsByType,
            pricing: [],
          };

          // Add to allLots (for search)
          allLots.push(lot);

          // Only add to map markers if has valid coordinates
          if (lat !== 0 || lng !== 0) {
            lotsWithCoords.push(lot);
          } else {
            console.log(`[HOME] Facility "${f.name}" — no coords, search only`);
          }
        }),
      );

      console.log(
        "[HOME] Lots with coords:",
        lotsWithCoords.length,
        "| All facilities:",
        allLots.length,
      );
      setParkingLots(lotsWithCoords);
      setAllFacilities(allLots);

      // Zoom to fit all markers
      if (lotsWithCoords.length > 0 && mapRef.current) {
        const lats = lotsWithCoords.map((l) => l.latitude);
        const lngs = lotsWithCoords.map((l) => l.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const midLat = (minLat + maxLat) / 2;
        const midLng = (minLng + maxLng) / 2;
        const deltaLat = (maxLat - minLat) * 1.5 || 0.02;
        const deltaLng = (maxLng - minLng) * 1.5 || 0.02;

        const fitRegion = {
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: Math.max(deltaLat, 0.01),
          longitudeDelta: Math.max(deltaLng, 0.01),
        };
        currentRegionRef.current = fitRegion;
        mapRef.current.animateToRegion(fitRegion, 500);
      }
    } catch (e) {
      console.log("[HOME] Failed to fetch facilities:", e);
    } finally {
      setDataLoading(false);
    }
  };

  // ─── Location Permission ───────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        let coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        // Simulator ngoài VN → dùng vị trí mặc định TP.HCM
        const isInVietnam =
          coords.latitude >= 8.0 && coords.latitude <= 23.5 &&
          coords.longitude >= 102.0 && coords.longitude <= 110.0;
        if (!isInVietnam) {
          coords = { latitude: 10.8231, longitude: 106.6297 };
        }
        setUserLocation(coords);
        // Animate map to user location
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035 * ASPECT_RATIO,
        }, 500);
      }
    })();
  }, []);

  // ─── Fetch data on screen focus ────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchFacilities();
    }, []),
  );

  // ─── Fetch vehicle types ──────────────────────────
  useEffect(() => {
    vehicleTypeApi
      .getVehicleTypes()
      .then((r: any) => {
        if (r.success) setVehicleTypes(r.data);
      })
      .catch(() => {});
  }, []);

  // ─── Calculate distance between two points ─────────
  const calcDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): string => {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  // ─── Get distance for a lot ────────────────────────
  const getDistance = (lot: ParkingLot): string => {
    if (userLocation) {
      return calcDistance(
        userLocation.latitude,
        userLocation.longitude,
        lot.latitude,
        lot.longitude,
      );
    }
    return lot.distance || "—";
  };

  // ─── Lazy-load pricing for a lot ───────────────────
  const loadPricingForLot = useCallback(async (lot: ParkingLot) => {
    if (lot.pricing.length > 0) return; // Already loaded
    setPricingLoading(true);
    try {
      const pricingData = await api.getPublicPricing(lot.id);
      // Update the lot in parkingLots state
      setParkingLots((prev) =>
        prev.map((l) => (l.id === lot.id ? { ...l, pricing: pricingData } : l)),
      );
      setSelectedLot((prev) =>
        prev?.id === lot.id ? { ...prev, pricing: pricingData } : prev,
      );
    } catch (e) {
      console.log("[HOME] Failed to load pricing:", e);
    } finally {
      setPricingLoading(false);
    }
  }, []);

  // ─── Bottom Sheet Handlers ─────────────────────────
  const showBottomSheet = useCallback(
    (lot: ParkingLot) => {
      setSelectedLot(lot);
      setShowSuggestions(false);
      Keyboard.dismiss();
      // Lazy-load pricing
      loadPricingForLot(lot);
      // Animate camera to marker
      mapRef.current?.animateToRegion(
        {
          latitude: lot.latitude - 0.006,
          longitude: lot.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012 * ASPECT_RATIO,
        },
        400,
      );
      // Slide up bottom sheet
      Animated.parallel([
        Animated.spring(bottomSheetAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [loadPricingForLot],
  );

  const hideBottomSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(bottomSheetAnim, {
        toValue: BOTTOM_SHEET_HEIGHT + 50,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSelectedLot(null));
  }, []);

  // ─── Navigate to current location ─────────────────
  const goToMyLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      let coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      // Simulator ngoài VN → dùng vị trí mặc định TP.HCM
      const isInVietnam =
        coords.latitude >= 8.0 && coords.latitude <= 23.5 &&
        coords.longitude >= 102.0 && coords.longitude <= 110.0;
      if (!isInVietnam) {
        coords = { latitude: 10.8231, longitude: 106.6297 };
      }
      setUserLocation(coords);
      mapRef.current?.animateToRegion(
        {
          ...coords,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012 * ASPECT_RATIO,
        },
        500,
      );
    } catch (e) {
      console.log("Location error:", e);
    } finally {
      setLocationLoading(false);
    }
  };

  // ─── Zoom In / Zoom Out (cross-platform via region delta) ──────
  const zoomIn = () => {
    const region = currentRegionRef.current;
    const newRegion: Region = {
      ...region,
      latitudeDelta: region.latitudeDelta / 2,
      longitudeDelta: region.longitudeDelta / 2,
    };
    currentRegionRef.current = newRegion;
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  const zoomOut = () => {
    const region = currentRegionRef.current;
    const newRegion: Region = {
      ...region,
      latitudeDelta: Math.min(region.latitudeDelta * 2, 100),
      longitudeDelta: Math.min(region.longitudeDelta * 2, 100),
    };
    currentRegionRef.current = newRegion;
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  // ─── Open Google Maps Directions ───────────────────
  const openDirections = (lot: ParkingLot) => {
    router.push({
      pathname: '/navigation/[facilityId]',
      params: {
        facilityId: lot.id,
        lat: String(lot.latitude),
        lng: String(lot.longitude),
        name: lot.name,
      },
    } as any);
  };

  // ─── Filter by vehicle type helper ────────────────
  const filterByVehicleType = (lots: ParkingLot[]) => {
    if (selectedVehicleType === "all") return lots;
    return lots.filter((lot) =>
      lot.slotsByType.some((s) => s.vehicleTypeId === selectedVehicleType),
    );
  };

  // ─── Filter lots by search (map markers) ──────────
  const mapMarkers = filterByVehicleType(parkingLots);

  // ─── Search suggestions (ALL facilities from DB) ──
  const searchSuggestions = (() => {
    let results = filterByVehicleType(allFacilities);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (lot) =>
          lot.name.toLowerCase().includes(q) ||
          lot.address.toLowerCase().includes(q),
      );
    }
    return results;
  })();

  // ─── Search text change handler ───────────────────
  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    setShowSuggestions(true);
  };

  // ─── Select a suggestion ──────────────────────────
  const onSelectSuggestion = (lot: ParkingLot) => {
    setSearchQuery("");
    setShowSuggestions(false);
    Keyboard.dismiss();
    // If facility has valid coordinates, show on map + bottom sheet
    if (lot.latitude !== 0 || lot.longitude !== 0) {
      showBottomSheet(lot);
    } else {
      // No coordinates — navigate directly to detail page
      router.push(`/facility/${lot.id}` as any);
    }
  };

  // ─── Map Press (dismiss) ──────────────────────────
  const onMapPress = () => {
    if (selectedLot) hideBottomSheet();
    if (showSuggestions) setShowSuggestions(false);
    Keyboard.dismiss();
  };

  // ═══════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── FULL-SCREEN MAP ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={INITIAL_REGION}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={onMapPress}
        onRegionChangeComplete={(region: Region) => {
          currentRegionRef.current = region;
        }}
        mapPadding={{ top: 80, right: 0, bottom: 0, left: 0 }}
      >
        {mapMarkers.map((lot) => {
          const isSelected = selectedLot?.id === lot.id;
          return (
            <Marker
              key={lot.id}
              coordinate={{ latitude: lot.latitude, longitude: lot.longitude }}
              onPress={() => showBottomSheet(lot)}
              tracksViewChanges={false}
            >
              <View style={styles.markerContainer}>
                <View
                  style={[
                    styles.markerBubble,
                    isSelected && styles.markerBubbleSelected,
                    lot.availableSlots === 0 && styles.markerBubbleFull,
                  ]}
                >
                  <Ionicons
                    name="car"
                    size={14}
                    color={
                      isSelected
                        ? "#FFF"
                        : lot.availableSlots === 0
                          ? Colors.danger
                          : UI.accentGreenDark
                    }
                  />
                  <Text
                    style={[
                      styles.markerText,
                      isSelected && styles.markerTextSelected,
                      lot.availableSlots === 0 && styles.markerTextFull,
                    ]}
                  >
                    {lot.availableSlots}
                  </Text>
                </View>
                <View
                  style={[
                    styles.markerArrow,
                    isSelected && styles.markerArrowSelected,
                    lot.availableSlots === 0 && styles.markerArrowFull,
                  ]}
                />
              </View>
            </Marker>
          );
        })}

        {/* ── USER LOCATION BLUE DOT ── */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.userLocationOuter}>
              <View style={styles.userLocationInner}>
                <View style={styles.userLocationDot} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── LOADING OVERLAY ── */}
      {dataLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color={UI.accentGreenDark} />
            <Text style={styles.loadingText}>Đang tải bãi xe...</Text>
          </View>
        </View>
      )}

      {/* ── FLOATING SEARCH BAR ── */}
      <SafeAreaView edges={["top"]} style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <View
            style={[
              styles.searchInputWrapper,
              showSuggestions && styles.searchInputWrapperActive,
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={showSuggestions ? UI.accentGreenDark : UI.textMuted}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm bãi đỗ xe, toà nhà..."
              placeholderTextColor={UI.textMuted}
              value={searchQuery}
              onChangeText={onSearchChange}
              onFocus={() => {
                setIsSearchFocused(true);
                setShowSuggestions(true);
              }}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setShowSuggestions(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={UI.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── VEHICLE TYPE FILTER CHIPS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
          style={styles.filterChipsContainer}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedVehicleType === "all" && styles.filterChipActive,
            ]}
            onPress={() => setSelectedVehicleType("all")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="apps-outline"
              size={14}
              color={selectedVehicleType === "all" ? "#FFF" : UI.textMedium}
            />
            <Text
              style={[
                styles.filterChipText,
                selectedVehicleType === "all" && styles.filterChipTextActive,
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>
          {vehicleTypes.map((type) => {
            const isActive = selectedVehicleType === type._id;
            const iconName = getVehicleIcon(type.code);
            return (
              <TouchableOpacity
                key={type._id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedVehicleType(type._id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={iconName}
                  size={14}
                  color={isActive ? "#FFF" : UI.textMedium}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {type.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── SEARCH SUGGESTIONS DROPDOWN ── */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {/* Header */}
            <View style={styles.suggestionsHeader}>
              <Ionicons
                name={searchQuery.trim() ? "search" : "business-outline"}
                size={14}
                color={UI.accentGreenDark}
              />
              <Text style={styles.suggestionsHeaderText}>
                {searchQuery.trim()
                  ? `Kết quả "${searchQuery}"`
                  : "Tất cả bãi xe"}
              </Text>
              <Text style={styles.suggestionsCount}>
                {searchSuggestions.length}
              </Text>
            </View>
            {searchSuggestions.length === 0 ? (
              <View style={styles.suggestionsEmpty}>
                <Ionicons
                  name="search-outline"
                  size={24}
                  color={UI.textMuted}
                />
                <Text style={styles.suggestionsEmptyText}>
                  Không tìm thấy "{searchQuery}"
                </Text>
              </View>
            ) : (
              <FlatList
                data={searchSuggestions}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionsList}
                renderItem={({ item }) => (
                  <SearchSuggestionItem
                    lot={item}
                    onPress={() => onSelectSuggestion(item)}
                    distanceText={
                      userLocation &&
                      (item.latitude !== 0 || item.longitude !== 0)
                        ? getDistance(item)
                        : undefined
                    }
                  />
                )}
                ItemSeparatorComponent={() => (
                  <View style={styles.suggestionSep} />
                )}
              />
            )}
          </View>
        )}
      </SafeAreaView>

      {/* ── MAP CONTROLS (Zoom + Location) ── */}
      <View style={styles.mapControls}>
        <View style={styles.zoomGroup}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={zoomIn}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={UI.textDark} />
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={zoomOut}
            activeOpacity={0.8}
          >
            <Ionicons name="remove" size={22} color={UI.textDark} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.locationBtn}
          onPress={goToMyLocation}
          activeOpacity={0.8}
        >
          {locationLoading ? (
            <ActivityIndicator size="small" color={UI.accentGreenDark} />
          ) : (
            <Ionicons name="locate" size={22} color={UI.accentGreenDark} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── BACKDROP ── */}
      {selectedLot && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.25],
              }),
            },
          ]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={hideBottomSheet}
          />
        </Animated.View>
      )}

      {/* ── BOTTOM SHEET ── */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { transform: [{ translateY: bottomSheetAnim }] },
        ]}
      >
        {selectedLot &&
          (() => {
            const isOpen = (() => {
              if (selectedLot.status !== "active") return false;
              if (!selectedLot.openTime || !selectedLot.closeTime) return true;
              const now = new Date();
              const nowMins = now.getHours() * 60 + now.getMinutes();
              const [openH, openM] = selectedLot.openTime
                .split(":")
                .map(Number);
              const [closeH, closeM] = selectedLot.closeTime
                .split(":")
                .map(Number);
              const openMins = openH * 60 + openM;
              const closeMins = closeH * 60 + closeM;
              if (closeMins <= openMins)
                return nowMins >= openMins || nowMins < closeMins;
              return nowMins >= openMins && nowMins < closeMins;
            })();

            return (
              <>
                {/* Drag handle */}
                <View style={styles.sheetHandle}>
                  <View style={styles.sheetHandleBar} />
                </View>

                {/* Header */}
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetIconWrap}>
                    <Ionicons
                      name="business"
                      size={22}
                      color={UI.accentGreenDark}
                    />
                  </View>
                  <View style={styles.sheetTitleWrap}>
                    <View style={styles.sheetNameRow}>
                      <Text style={styles.sheetName} numberOfLines={1}>
                        {selectedLot.name}
                      </Text>
                      <View
                        style={[
                          styles.sheetStatusPill,
                          {
                            backgroundColor: isOpen
                              ? Colors.success + "20"
                              : Colors.danger + "20",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.sheetStatusDot,
                            {
                              backgroundColor: isOpen
                                ? Colors.success
                                : Colors.danger,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.sheetStatusText,
                            { color: isOpen ? Colors.success : Colors.danger },
                          ]}
                        >
                          {isOpen ? "Mở cửa" : "Đóng"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sheetAddressRow}>
                      <Ionicons
                        name="location"
                        size={13}
                        color={UI.textLight}
                      />
                      <Text style={styles.sheetAddress} numberOfLines={1}>
                        {selectedLot.address}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={hideBottomSheet}
                    style={styles.sheetCloseBtn}
                  >
                    <Ionicons name="close" size={20} color={UI.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Scrollable content */}
                <ScrollView
                  style={styles.sheetScrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {/* Info chips */}
                  <View style={styles.sheetInfoRow}>
                    <View style={styles.sheetInfoChip}>
                      <Ionicons
                        name="navigate-outline"
                        size={14}
                        color={UI.accentGreenDark}
                      />
                      <Text style={styles.sheetInfoText}>
                        {getDistance(selectedLot)}
                      </Text>
                    </View>
                    <View style={styles.sheetInfoChip}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={UI.accentGreenDark}
                      />
                      <Text style={styles.sheetInfoText}>
                        {selectedLot.openTime} – {selectedLot.closeTime}
                      </Text>
                    </View>
                    <SlotBadge
                      available={selectedLot.availableSlots}
                    />
                  </View>

                  {/* Slots by vehicle type */}
                  {selectedLot.slotsByType.length > 0 && (
                    <View style={styles.sheetSlotsSection}>
                      <Text style={styles.sheetSectionTitle}>
                        Chỗ trống theo loại xe
                      </Text>
                      <View style={styles.sheetSlotsGrid}>
                        {selectedLot.slotsByType.map((slot) => {
                          const avail = slot.availableCount;
                          const dotColor =
                            avail > 10
                              ? Colors.success
                              : avail > 0
                                ? Colors.warning
                                : Colors.danger;
                          return (
                            <View
                              key={slot.vehicleTypeId}
                              style={styles.sheetSlotCard}
                            >
                              <View
                                style={[
                                  styles.sheetSlotIconWrap,
                                  { backgroundColor: dotColor + "15" },
                                ]}
                              >
                                <Ionicons
                                  name={getVehicleIcon(slot.vehicleTypeCode)}
                                  size={18}
                                  color={dotColor}
                                />
                              </View>
                              <View style={styles.sheetSlotInfo}>
                                <Text
                                  style={styles.sheetSlotTypeName}
                                  numberOfLines={1}
                                >
                                  {slot.vehicleTypeName}
                                </Text>
                                <Text
                                  style={[
                                    styles.sheetSlotCount,
                                    { color: dotColor },
                                  ]}
                                >
                                  {avail} chỗ
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Pricing summary */}
                  <View style={styles.sheetPricingSection}>
                    <Text style={styles.sheetSectionTitle}>Bảng giá</Text>
                    {pricingLoading ? (
                      <View style={styles.sheetPricingLoading}>
                        <ActivityIndicator
                          size="small"
                          color={UI.accentGreenDark}
                        />
                        <Text style={styles.sheetPricingLoadingText}>
                          Đang tải bảng giá...
                        </Text>
                      </View>
                    ) : selectedLot.pricing.length === 0 ? (
                      <Text style={styles.sheetPricingEmpty}>
                        Chưa có bảng giá
                      </Text>
                    ) : (
                      selectedLot.pricing.map((plan) => (
                        <View key={plan._id} style={styles.sheetPricingCard}>
                          <View style={styles.sheetPricingHeader}>
                            <Ionicons
                              name={getVehicleIcon(plan.vehicleTypeId?.code)}
                              size={15}
                              color={UI.accentGreenDark}
                            />
                            <Text
                              style={styles.sheetPricingName}
                              numberOfLines={1}
                            >
                              {plan.vehicleTypeId?.name || plan.name}
                            </Text>
                          </View>
                          {plan.rates?.slice(0, 2).map((rate, i) => (
                            <View key={i} style={styles.sheetPriceRow}>
                              <Text style={styles.sheetPriceLabel}>
                                {rate.label}
                              </Text>
                              <Text style={styles.sheetPriceValue}>
                                {rate.amount.toLocaleString("vi-VN")}đ /{" "}
                                {rate.unit}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>

                {/* Action buttons — sticky at bottom */}
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={styles.directionsBtn}
                    onPress={() => openDirections(selectedLot)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="navigate"
                      size={18}
                      color={UI.accentGreenDark}
                    />
                    <Text style={styles.directionsBtnText}>Chỉ đường</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.bookBtn,
                      selectedLot.availableSlots === 0 &&
                        styles.bookBtnDisabled,
                    ]}
                    onPress={() => {
                      hideBottomSheet();
                      router.push(`/facility/${selectedLot.id}` as any);
                    }}
                    activeOpacity={0.85}
                    disabled={selectedLot.availableSlots === 0}
                  >
                    <Ionicons
                      name="calendar"
                      size={18}
                      color={
                        selectedLot.availableSlots === 0
                          ? UI.textMuted
                          : Colors.white
                      }
                    />
                    <Text
                      style={[
                        styles.bookBtnText,
                        selectedLot.availableSlots === 0 &&
                          styles.bookBtnTextDisabled,
                      ]}
                    >
                      {selectedLot.availableSlots === 0
                        ? "Hết chỗ"
                        : "Đặt chỗ trước"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Map ──────────────────────────────────────────
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── Loading Overlay ──────────────────────────────
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
    pointerEvents: "none",
  },
  loadingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: UI.cardBg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textMedium,
  },

  // ── Floating Search Bar ──────────────────────────
  searchBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI.searchBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  searchInputWrapperActive: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    shadowOpacity: 0.08,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textDark,
    paddingVertical: 0,
  },

  // ── Vehicle Type Filter Chips ────────────────────
  filterChipsContainer: {
    marginTop: 8,
    marginHorizontal: 16,
    maxHeight: 40,
  },
  filterChipsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  filterChipActive: {
    backgroundColor: Colors.brandDark,
    shadowColor: Colors.brandDark,
    shadowOpacity: 0.3,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textMedium,
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },

  // ── Search Suggestions ───────────────────────────
  suggestionsContainer: {
    marginHorizontal: 16,
    backgroundColor: UI.cardBg,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    maxHeight: 260,
    overflow: "hidden",
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  suggestionsList: {
    paddingVertical: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  suggestionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textDark,
    marginBottom: 2,
  },
  suggestionAddress: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: UI.textLight,
  },
  suggestionSlotBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: "center",
  },
  suggestionSlotText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
  },
  suggestionMeta: {
    flex: 1,
  },
  suggestionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  suggestionMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  suggestionMetaText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textLight,
  },
  suggestionStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  suggestionSep: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionsHeaderText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textLight,
  },
  suggestionsCount: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: UI.accentGreenDark,
    backgroundColor: Colors.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  suggestionsEmpty: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  suggestionsEmptyText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textMuted,
  },

  // ── Map Controls (Zoom + Location) ───────────────
  mapControls: {
    position: "absolute",
    right: 16,
    bottom: 120,
    alignItems: "center",
    zIndex: 5,
    gap: 10,
  },
  zoomGroup: {
    backgroundColor: UI.cardBg,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  controlDivider: {
    width: 28,
    height: 1,
    backgroundColor: Colors.borderLight,
    alignSelf: "center",
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: UI.cardBg,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },

  // ── Custom Marker ────────────────────────────────
  markerContainer: {
    alignItems: "center",
  },
  markerBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: UI.accentGreen,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  markerBubbleSelected: {
    backgroundColor: Colors.brandDark,
    borderColor: Colors.brandDark,
  },
  markerBubbleFull: {
    borderColor: Colors.danger,
    backgroundColor: "#FFF5F5",
  },
  markerText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: UI.accentGreenDark,
  },
  markerTextSelected: { color: "#FFFFFF" },
  markerTextFull: { color: Colors.danger },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: UI.accentGreen,
    marginTop: -1,
  },
  markerArrowSelected: { borderTopColor: Colors.brandDark },
  markerArrowFull: { borderTopColor: Colors.danger },

  // ── Backdrop ─────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    zIndex: 15,
  },

  // ── Bottom Sheet ─────────────────────────────────
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: UI.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    zIndex: 20,
    shadowColor: UI.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  sheetHandle: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E4DC",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sheetIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primaryBg,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitleWrap: { flex: 1 },
  sheetNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  sheetName: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: UI.textDark,
    flexShrink: 1,
  },
  sheetStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sheetStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sheetStatusText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
  },
  sheetAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sheetAddress: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: UI.textLight,
    flex: 1,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  sheetInfoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sheetInfoText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textMedium,
  },
  slotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: "auto",
  },
  slotDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  slotBadgeText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },
  capacityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textLight,
  },
  capacityValue: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textMedium,
  },
  capacityTrack: {
    height: 5,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  sheetScrollContent: {
    flex: 1,
    marginBottom: 8,
  },
  sheetSlotsSection: {
    marginBottom: 12,
  },
  sheetSectionTitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sheetSlotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sheetSlotCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: "46%",
    flex: 1,
  },
  sheetSlotIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSlotInfo: {
    flex: 1,
  },
  sheetSlotTypeName: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textMedium,
  },
  sheetSlotCount: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
  },
  sheetPricingSection: {
    marginBottom: 4,
  },
  sheetPricingLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  sheetPricingLoadingText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textMuted,
  },
  sheetPricingEmpty: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: UI.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },
  sheetPricingCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  sheetPricingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  sheetPricingName: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.textDark,
    flex: 1,
  },
  sheetPriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  sheetPriceLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: UI.textLight,
  },
  sheetPriceValue: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.semiBold,
    color: UI.accentGreenDark,
  },
  capacityFill: {
    height: "100%",
    borderRadius: 3,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 12,
  },
  directionsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 9999,
    backgroundColor: Colors.brandGray,
    borderWidth: 0,
  },
  directionsBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  bookBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 9999,
    backgroundColor: Colors.brandLime,
    shadowColor: Colors.brandLime,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  bookBtnDisabled: {
    backgroundColor: Colors.brandGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  bookBtnText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  bookBtnTextDisabled: {
    color: UI.textMuted,
  },
  // ── User Location Blue Dot ──
  userLocationOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 122, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  userLocationInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  userLocationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#007AFF",
  },
});
