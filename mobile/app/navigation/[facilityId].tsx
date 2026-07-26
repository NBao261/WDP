import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  FlatList,
  Dimensions,
  StatusBar,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Typography } from "../../src/constants/theme";
import {
  getDirections,
  formatDistance,
  formatDuration,
  getManeuverIcon,
  RouteResult,
  RouteStep,
} from "../../src/services/mapbox";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function NavigationScreen() {
  const router = useRouter();
  const { facilityId, lat, lng, name } = useLocalSearchParams<{
    facilityId: string;
    lat: string;
    lng: string;
    name: string;
  }>();

  const mapRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooFar, setTooFar] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  const togglePanel = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPanelExpanded(!isPanelExpanded);
  };

  const destLat = parseFloat(lat || "0");
  const destLng = parseFloat(lng || "0");
  const facilityName = name || "Bãi đỗ xe";

  // ─── Get user location + fetch directions ────────────
  const fetchRoute = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTooFar(false);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Cần cấp quyền truy cập vị trí để chỉ đường");
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      let origin = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      // Nếu vị trí nằm ngoài Việt Nam (simulator) → dùng vị trí mặc định TP.HCM
      const isInVietnam =
        origin.latitude >= 8.0 && origin.latitude <= 23.5 &&
        origin.longitude >= 102.0 && origin.longitude <= 110.0;
      if (!isInVietnam) {
        console.log('[Navigation] Vị trí ngoài VN, dùng mặc định TP.HCM');
        origin = { latitude: 10.8231, longitude: 106.6297 };
      }

      setUserLocation(origin);

      const destination = { latitude: destLat, longitude: destLng };
      const result = await getDirections(origin, destination);

      if (result === 'TOO_FAR') {
        setTooFar(true);
      } else if (result) {
        setRoute(result);
        // Fit map to show entire route
        setTimeout(() => {
          if (mapRef.current && result.coordinates.length > 0) {
            mapRef.current.fitToCoordinates(result.coordinates, {
              edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
              animated: true,
            });
          }
        }, 500);
      } else {
        setError("Không thể tìm đường đi. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("[Navigation] Error:", err);
      setError("Đã xảy ra lỗi khi tìm đường");
    } finally {
      setLoading(false);
    }
  }, [destLat, destLng]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // ─── Open external Google Maps ────────────────────────
  const openGoogleMaps = () => {
    const origin = userLocation
      ? `${userLocation.latitude},${userLocation.longitude}`
      : "";
    const destination = `${destLat},${destLng}`;
    const url = Platform.select({
      ios: `comgooglemaps://?saddr=${origin}&daddr=${destination}&directionsmode=driving`,
      android: `google.navigation:q=${destination}`,
    });
    const fallback = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => Linking.openURL(supported ? url : fallback))
        .catch(() => Linking.openURL(fallback));
    } else {
      Linking.openURL(fallback);
    }
  };

  // ─── Step item renderer ───────────────────────────────
  const renderStep = ({ item, index }: { item: RouteStep; index: number }) => {
    const isFirst = index === 0;
    const isLast = index === (route?.steps.length || 0) - 1;
    const iconName = getManeuverIcon(item.maneuver.type, item.maneuver.modifier);

    return (
      <View style={styles.stepItem}>
        {/* Timeline */}
        <View style={styles.stepTimeline}>
          {!isFirst && <View style={styles.stepLineTop} />}
          <View
            style={[
              styles.stepDot,
              isFirst && styles.stepDotStart,
              isLast && styles.stepDotEnd,
            ]}
          >
            <Ionicons
              name={iconName as any}
              size={12}
              color={isFirst || isLast ? "#FFF" : Colors.brandDark}
            />
          </View>
          {!isLast && <View style={styles.stepLineBottom} />}
        </View>

        {/* Content */}
        <View style={styles.stepContent}>
          <Text style={styles.stepInstruction}>{item.instruction}</Text>
          {item.distance > 0 && (
            <Text style={styles.stepMeta}>
              {formatDistance(item.distance)} · {formatDuration(item.duration)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" />

        {/* ── MAP ── */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: destLat || 10.7769,
            longitude: destLng || 106.7009,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {/* Route Polyline */}
          {route && route.coordinates.length > 0 && (
            <Polyline
              coordinates={route.coordinates}
              strokeColor={Colors.brandLime}
              strokeWidth={5}
              lineDashPattern={undefined}
            />
          )}

          {/* Origin Marker (vị trí xuất phát) */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              tracksViewChanges={false}
            >
              <View style={styles.originMarker}>
                <View style={styles.originMarkerDot} />
              </View>
            </Marker>
          )}

          {/* Destination Marker */}
          {destLat !== 0 && destLng !== 0 && (
            <Marker
              coordinate={{ latitude: destLat, longitude: destLng }}
              tracksViewChanges={false}
            >
              <View style={styles.destMarker}>
                <View style={styles.destMarkerInner}>
                  <Ionicons name="flag" size={16} color="#FFF" />
                </View>
                <View style={styles.destMarkerArrow} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* ── HEADER OVERLAY ── */}
        <SafeAreaView edges={["top"]} style={styles.headerOverlay}>
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={18} color={Colors.brandDark} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {facilityName}
              </Text>
              {route && (
                <Text style={styles.headerSubtitle}>
                  {formatDistance(route.distance)} ·{" "}
                  {formatDuration(route.duration)}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={openGoogleMaps}
              activeOpacity={0.7}
            >
              <Ionicons name="open-outline" size={16} color={Colors.brandDark} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* ── BOTTOM PANEL ── */}
        <View style={styles.bottomPanel}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.brandDark} />
              <Text style={styles.loadingText}>
                Đang tìm đường...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons
                name="warning-outline"
                size={24}
                color={Colors.warning}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchRoute}>
                <Text style={styles.retryBtnText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : tooFar ? (
            <View style={styles.errorContainer}>
              <Ionicons
                name="map-outline"
                size={32}
                color={Colors.brandDark}
              />
              <Text style={styles.tooFarTitle}>Khoảng cách quá xa</Text>
              <Text style={styles.errorText}>
                Vị trí hiện tại của bạn quá xa bãi xe để hiển thị chỉ đường trong app. Hãy sử dụng Google Maps để điều hướng.
              </Text>
              <TouchableOpacity style={styles.gmapsBtn} onPress={openGoogleMaps}>
                <Ionicons name="navigate" size={18} color={Colors.brandDark} />
                <Text style={styles.gmapsBtnText}>Mở Google Maps</Text>
              </TouchableOpacity>
            </View>
          ) : route ? (
            <>
              {/* Toggle Handle */}
              <TouchableOpacity
                style={styles.panelHandleArea}
                onPress={togglePanel}
                activeOpacity={0.7}
              >
                <View style={styles.panelHandle} />
                <Ionicons
                  name={isPanelExpanded ? "chevron-down" : "chevron-up"}
                  size={20}
                  color={Colors.brandGrayText}
                />
              </TouchableOpacity>

              {/* Summary bar */}
              <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                  <Ionicons
                    name="navigate"
                    size={16}
                    color={Colors.brandDark}
                  />
                  <Text style={styles.summaryValue}>
                    {formatDistance(route.distance)}
                  </Text>
                  <Text style={styles.summaryLabel}>Khoảng cách</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="time" size={16} color={Colors.brandDark} />
                  <Text style={styles.summaryValue}>
                    {formatDuration(route.duration)}
                  </Text>
                  <Text style={styles.summaryLabel}>Thời gian</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons
                    name="footsteps"
                    size={16}
                    color={Colors.brandDark}
                  />
                  <Text style={styles.summaryValue}>
                    {route.steps.length}
                  </Text>
                  <Text style={styles.summaryLabel}>Bước</Text>
                </View>
              </View>

              {/* Expandable Content */}
              {isPanelExpanded && (
                <>
                  <FlatList
                    data={route.steps}
                    keyExtractor={(_, i) => String(i)}
                    renderItem={renderStep}
                    contentContainerStyle={styles.stepsList}
                    showsVerticalScrollIndicator={false}
                  />
                  <View style={styles.bottomActions}>
                    <TouchableOpacity
                      style={styles.gmapsBtn}
                      onPress={openGoogleMaps}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="navigate"
                        size={18}
                        color={Colors.brandDark}
                      />
                      <Text style={styles.gmapsBtnText}>
                        Mở Google Maps
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  map: { flex: 1 },

  // ── Destination Marker ──
  destMarker: { alignItems: "center" },
  destMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.brandLime,
  },
  destMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.brandDark,
    marginTop: -2,
  },

  // ── Origin Marker (điểm xuất phát) ──
  originMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(66, 133, 244, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  originMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4285F4",
    borderWidth: 2.5,
    borderColor: "#FFF",
  },

  // ── Header Overlay ──
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  headerCenter: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandGrayText,
    marginTop: 1,
  },

  // ── Bottom Panel ──
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "55%",
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  panelHandleArea: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  panelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brandGray,
    marginBottom: 4,
  },

  // ── Loading & Error ──
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 30,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandGrayText,
  },
  errorContainer: {
    alignItems: "center",
    padding: 30,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandGrayText,
    textAlign: "center",
  },
  tooFarTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },

  // ── Summary Bar ──
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandGray,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandGrayText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.brandGray,
  },

  // ── Steps ──
  stepsList: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  stepItem: {
    flexDirection: "row",
    minHeight: 56,
  },
  stepTimeline: {
    width: 32,
    alignItems: "center",
  },
  stepLineTop: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.brandGray,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotStart: {
    backgroundColor: Colors.brandLime,
  },
  stepDotEnd: {
    backgroundColor: Colors.brandDark,
  },
  stepLineBottom: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.brandGray,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 12,
    paddingVertical: 6,
    justifyContent: "center",
  },
  stepInstruction: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.brandDark,
    lineHeight: 18,
  },
  stepMeta: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.brandGrayText,
    marginTop: 2,
  },

  // ── Bottom Actions ──
  bottomActions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: Colors.brandGray,
  },
  gmapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    paddingVertical: 14,
  },
  gmapsBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
});
