import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import * as ImageManipulator from "expo-image-manipulator";

let NfcManager: any = null;
let NfcTech: any = null;
try {
  const nfcModule = require("react-native-nfc-manager");
  NfcManager = nfcModule.default;
  NfcTech = nfcModule.NfcTech;
} catch (e) {
  console.warn("NFC module is not available in this environment (likely Expo Go).");
}
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from "../../src/constants/theme";
import { formatPlate, matchVehicleType } from "../../src/utils/format";
import {
  alprApi,
  sessionApi,
  paymentApi,
  facilityApi,

  getBaseUrl,
} from "../../src/services/api";
import { useAuthStore } from "../../src/store/useAuthStore";

export default function StaffScanScreen() {
  const router = useRouter();
  const { user, selectedFacilityId } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // States
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);

  // Modal States
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [plateData, setPlateData] = useState<{
    plate: string;
    imageUrl: string;
  } | null>(null);


  // Checkout Specific States
  const [checkoutSession, setCheckoutSession] = useState<any>(null);
  const [checkoutFee, setCheckoutFee] = useState<any>(null);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  // Selected vehicle type for check-in
  const [selectedVehicleType, setSelectedVehicleType] = useState<string | null>(
    null,
  );

  // NFC States
  const [nfcUid, setNfcUid] = useState<string | null>(null);
  const [isScanningNfc, setIsScanningNfc] = useState(false);

  useEffect(() => {
    async function initNfc() {
      try {
        await NfcManager?.start();
      } catch (ex) {
        console.warn("NFC start error", ex);
      }
    }
    initNfc();
    return () => {
      NfcManager?.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  const scanNfc = async (onSuccess: (uid: string) => void) => {
    if (!NfcManager) {
      Alert.alert("Lỗi", "NFC không được hỗ trợ trên thiết bị này hoặc đang chạy trên Expo Go.");
      return;
    }
    setIsScanningNfc(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (tag && tag.id) {
        setNfcUid(tag.id);
        onSuccess(tag.id);
      }
    } catch (ex) {
      console.warn("NFC Error", ex);
      Alert.alert("Lỗi", "Không thể đọc thẻ NFC hoặc đã hủy.");
    } finally {
      NfcManager?.cancelTechnologyRequest();
      setIsScanningNfc(false);
    }
  };

  const getFullImageUrl = (path?: string) => {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBaseUrl()}${cleanPath}`;
  };

  useEffect(() => {
    if (selectedFacilityId) {
      fetchVehicleTypes(selectedFacilityId);
    }
  }, [selectedFacilityId]);

  const fetchVehicleTypes = async (fid: string) => {
    try {
      const res = await facilityApi.getOperationsConfig(fid);
      if (res.data?.allowedVehicleTypes) {
        setVehicleTypes(res.data.allowedVehicleTypes);
      }
    } catch (e) {
      console.log("Error fetching facility config", e);
    }
  };

  const getFacilityId = () => {
    return selectedFacilityId;
  };



  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Vui lòng cấp quyền sử dụng camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Cấp quyền</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const facilityId = getFacilityId();
  if (!facilityId) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Bạn chưa được phân công bãi xe nào.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: false,
          quality: 0.5,
        });
        if (photo) {
          const cropWidth = photo.width * (GUIDE_BOX_WIDTH / screenWidth);
          const cropHeight = photo.height * (GUIDE_BOX_HEIGHT / screenHeight);
          const originX = (photo.width - cropWidth) / 2;
          const originY = (photo.height - cropHeight) / 2;

          const manipResult = await ImageManipulator.manipulateAsync(
            photo.uri,
            [
              {
                crop: {
                  originX,
                  originY,
                  width: cropWidth,
                  height: cropHeight,
                },
              },
            ],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
          );

          setScannedImage(manipResult.uri);
          processImage(manipResult.uri);
        }
      } catch (error) {
        Alert.alert("Lỗi", "Không thể chụp ảnh");
      }
    }
  };

  const processImage = async (uri: string) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append("image", {
        uri,
        name: "plate.jpg",
        type: "image/jpeg",
      });

      // 1. Call ALPR
      const alprRes = await alprApi.scanPlate(formData);
      if (!alprRes.success) {
        Alert.alert(
          "Thông báo",
          alprRes.message || "Không nhận dạng được biển số.",
        );
        resetScan();
        return;
      }

      const { licensePlate, imageUrl } = alprRes.data;
      const formattedPlate = formatPlate(licensePlate);
      setPlateData({ plate: formattedPlate, imageUrl });


      // 2. Search for active session with this plate
      try {
        const searchRes = await sessionApi.searchSession({
          licensePlate: formattedPlate,
        });
        const session = searchRes.data;

        const sessionFacilityId =
          session?.facilityId?._id || session?.facilityId;
        if (
          session &&
          session.status === "active" &&
          sessionFacilityId === facilityId
        ) {
          // CHECK-OUT FLOW
          setCheckoutSession(session);
          setShowCheckOutModal(true);
          calculateFee(session._id);
        } else {
          // CHECK-IN FLOW (No active session at this facility)
          if (vehicleTypes.length > 0) {
            const matchedTypeId = matchVehicleType(
              formattedPlate,
              vehicleTypes,
            );
            setSelectedVehicleType(matchedTypeId || vehicleTypes[0]._id);
          }
          setShowCheckInModal(true);
        }
      } catch (searchErr: any) {
        // If 404 not found, it means it's a Check-in flow
        if (
          searchErr?.status === 404 ||
          searchErr?.message?.includes("not found") ||
          searchErr?.message?.includes("Không tìm thấy")
        ) {
          if (vehicleTypes.length > 0) {
            const matchedTypeId = matchVehicleType(
              formattedPlate,
              vehicleTypes,
            );
            setSelectedVehicleType(matchedTypeId || vehicleTypes[0]._id);
          }
          setShowCheckInModal(true);
        } else {
          throw searchErr; // Re-throw if it's another error
        }
      }
    } catch (error: any) {
      console.log("ALPR/Process Error", error);
      Alert.alert(
        "Lỗi xử lý",
        error.message || "Có lỗi xảy ra khi xử lý biển số.",
      );
      resetScan();
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateFee = async (sessionId: string) => {
    setIsCalculatingFee(true);
    try {
      const feeRes = await sessionApi.calculateFee(sessionId);
      setCheckoutFee(feeRes.data);
    } catch (error) {
      console.log("Fee calculation error", error);
      Alert.alert("Lỗi", "Không thể tính phí.");
    } finally {
      setIsCalculatingFee(false);
    }
  };

  const handleNfcScanInCheckInModal = async () => {
    await scanNfc(async (uid) => {
      // Khi đọc được thẻ, kiểm tra xem thẻ này có đang giữ xe không
      try {
        const searchRes = await sessionApi.searchSession({ cardCode: uid });
        const session = searchRes.data;
        if (session && session.status === "active") {
          // Thẻ này đang giữ xe => Chuyển sang Check-out Modal!
          setShowCheckInModal(false);
          setCheckoutSession(session);
          setShowCheckOutModal(true);
          calculateFee(session._id);
        }
      } catch (err: any) {
        // Thẻ chưa sử dụng (404) -> Tiếp tục Check-in bình thường, nfcUid đã được set
        Alert.alert("Thành công", `Đã nhận thẻ NFC: ${uid}`);
      }
    });
  };

  const handleCheckIn = async () => {
    if (!selectedVehicleType || !plateData) return;
    setIsProcessing(true);
    try {
      await sessionApi.checkIn({
        facilityId,
        vehicleTypeId: selectedVehicleType,
        licensePlate: plateData.plate,
        checkInImage: plateData.imageUrl,
        cardCode: nfcUid || undefined,
      });
      Alert.alert("Thành công", `Đã tạo lượt gửi cho xe ${plateData.plate}`);
      resetScan();
    } catch (error: any) {
      Alert.alert("Lỗi Check-in", error.message || "Không thể tạo lượt gửi");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!checkoutSession) return;
    setIsProcessing(true);
    try {
      await paymentApi.cashCheckout({
        sessionId: checkoutSession._id,
        checkOutImage: plateData?.imageUrl,
      });
      Alert.alert(
        "Thành công",
        `Đã thanh toán và check-out xe ${plateData?.plate}`,
      );
      resetScan();
    } catch (error: any) {
      Alert.alert(
        "Lỗi Check-out",
        error.message || "Không thể hoàn tất check-out",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    setScannedImage(null);
    setPlateData(null);
    setShowCheckInModal(false);
    setShowCheckOutModal(false);
    setCheckoutSession(null);
    setCheckoutFee(null);
    setNfcUid(null);
  };

  return (
    <View style={styles.container}>
      {scannedImage ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: scannedImage }} style={styles.preview} />
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.processingText}>Đang xử lý...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <CameraView style={styles.camera} facing="back" ref={cameraRef} />

          {/* Overlay on camera */}
          <View style={[styles.overlay, StyleSheet.absoluteFillObject]}>
            {/* Header overlay */}
            <SafeAreaView edges={["top"]} style={styles.headerOverlay}>
              <View>
                <Text style={styles.headerTitle}>Quét Biển Số</Text>
                <Text style={styles.headerSub}>
                  Tự động nhận diện biển số xe
                </Text>
              </View>

            </SafeAreaView>

            {/* Corner brackets viewfinder */}
            <View style={styles.viewfinderArea}>
              <View style={styles.guideBox}>
                {/* Top-left corner */}
                <View style={[styles.corner, styles.cornerTL]} />
                {/* Top-right corner */}
                <View style={[styles.corner, styles.cornerTR]} />
                {/* Bottom-left corner */}
                <View style={[styles.corner, styles.cornerBL]} />
                {/* Bottom-right corner */}
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.hintBox}>
                <Text style={styles.guideText}>
                  {isProcessing
                    ? "Đang xử lý hình ảnh..."
                    : "Đặt biển số vào giữa khung hình"}
                </Text>
              </View>
            </View>

            {/* Shutter button area */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
                disabled={isProcessing}
                activeOpacity={0.8}
              >
                <View style={styles.captureInner}>
                  {isProcessing ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="camera" size={28} color={Colors.primary} />
                  )}
                </View>
              </TouchableOpacity>
              <Text style={styles.tapLabel}>
                {isProcessing ? "Đang Quét..." : "CHẠM ĐỂ QUÉT"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Check-in Modal */}
      <Modal visible={showCheckInModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận Check-in</Text>
              <TouchableOpacity onPress={resetScan} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Plate display */}
            <View style={styles.plateDisplayWrap}>
              <Text style={styles.plateDisplayLabel}>BIỂN SỐ NHẬN DIỆN</Text>
              <Text style={styles.plateDisplayText}>{plateData?.plate}</Text>
            </View>

            <Text style={styles.modalLabel}>Chọn loại xe:</Text>
            <View style={styles.vehicleTypeContainer}>
              {vehicleTypes.map((vt) => (
                <TouchableOpacity
                  key={vt._id}
                  style={[
                    styles.vtButton,
                    selectedVehicleType === vt._id && styles.vtButtonActive,
                  ]}
                  onPress={() => setSelectedVehicleType(vt._id)}
                >
                  <Text
                    style={[
                      styles.vtButtonText,
                      selectedVehicleType === vt._id &&
                        styles.vtButtonTextActive,
                    ]}
                  >
                    {vt.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.nfcSection}>
              <Text style={styles.modalLabel}>Thẻ NFC:</Text>
              {nfcUid ? (
                <Text style={styles.nfcUidText}>{nfcUid}</Text>
              ) : (
                <TouchableOpacity
                  style={styles.nfcButton}
                  onPress={handleNfcScanInCheckInModal}
                  disabled={isScanningNfc}
                >
                  <Ionicons
                    name="radio-outline"
                    size={20}
                    color={Colors.brandDark}
                  />
                  <Text style={styles.nfcButtonText}>
                    {isScanningNfc ? "Đang chờ thẻ..." : "Quét thẻ NFC"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resetScan}
              >
                <Text style={styles.cancelButtonText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!selectedVehicleType || isProcessing) && styles.disabledButton,
                ]}
                onPress={handleCheckIn}
                disabled={!selectedVehicleType || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={Colors.brandDark} />
                ) : (
                  <Text style={styles.primaryButtonText}>Xác Nhận Vào</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Check-out Modal */}
      <Modal visible={showCheckOutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận Check-out</Text>
              <TouchableOpacity onPress={resetScan} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.plateDisplayWrap}>
              <Text style={styles.plateDisplayLabel}>BIỂN SỐ NHẬN DIỆN</Text>
              <Text style={styles.plateDisplayText}>{plateData?.plate}</Text>
            </View>

            {checkoutSession && (
              <View style={styles.sessionDetails}>
                <Text style={styles.detailText}>
                  Vào lúc:{" "}
                  {checkoutSession.checkInTime
                    ? new Date(checkoutSession.checkInTime).toLocaleString(
                        "vi-VN",
                      )
                    : "Không rõ"}
                </Text>
                {checkoutSession.checkInImage && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.detailText, { marginBottom: 8 }]}>
                      Ảnh lúc vào:
                    </Text>
                    <Image
                      source={{
                        uri: getFullImageUrl(checkoutSession.checkInImage),
                      }}
                      style={{
                        width: "100%",
                        height: 120,
                        borderRadius: 12,
                        resizeMode: "cover",
                      }}
                    />
                  </View>
                )}
              </View>
            )}

            <View style={styles.feeContainer}>
              <Text style={styles.feeLabel}>Phí gửi xe:</Text>
              {isCalculatingFee ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.feeValue}>
                  {checkoutFee?.totalFee?.toLocaleString("vi-VN")} VNĐ
                </Text>
              )}
            </View>

            <View style={styles.nfcSection}>
              <Text style={styles.modalLabel}>Xác nhận thẻ NFC:</Text>
              {nfcUid ? (
                <Text
                  style={[
                    styles.nfcUidText,
                    nfcUid === checkoutSession?.cardCode
                      ? { color: Colors.success }
                      : { color: Colors.danger },
                  ]}
                >
                  {nfcUid === checkoutSession?.cardCode
                    ? `Khớp thẻ: ${nfcUid}`
                    : `Thẻ sai: ${nfcUid}`}
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.nfcButton}
                  onPress={() =>
                    scanNfc((uid) => console.log("Checked out card", uid))
                  }
                  disabled={isScanningNfc}
                >
                  <Ionicons
                    name="radio-outline"
                    size={20}
                    color={Colors.brandDark}
                  />
                  <Text style={styles.nfcButtonText}>
                    {isScanningNfc ? "Đang chờ thẻ..." : "Quét thẻ NFC"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resetScan}
              >
                <Text style={styles.cancelButtonText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (isCalculatingFee ||
                    isProcessing ||
                    !!(nfcUid && nfcUid !== checkoutSession?.cardCode)) &&
                    styles.disabledButton,
                ]}
                onPress={handleCheckOut}
                disabled={
                  isCalculatingFee ||
                  isProcessing ||
                  !!(nfcUid && nfcUid !== checkoutSession?.cardCode)
                }
              >
                {isProcessing ? (
                  <ActivityIndicator color={Colors.brandDark} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Thu tiền & Check-out
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GUIDE_BOX_WIDTH = SCREEN_WIDTH * 0.9;
const GUIDE_BOX_HEIGHT = GUIDE_BOX_WIDTH * 0.75;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  message: { textAlign: "center", padding: 20, color: Colors.textPrimary },
  camera: { flex: 1 },
  previewContainer: { flex: 1, position: "relative" },
  preview: { flex: 1, resizeMode: "contain" },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    color: Colors.white,
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },

  // ── Header Overlay ──
  headerOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontFamily: Typography.fontFamily.regular,
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  // ── Viewfinder ──
  viewfinderArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  guideBox: {
    width: GUIDE_BOX_WIDTH,
    height: GUIDE_BOX_HEIGHT,
    backgroundColor: "transparent",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: Colors.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  hintBox: {
    marginTop: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  guideText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Typography.fontFamily.medium,
    textAlign: "center",
  },

  // ── Shutter Controls ──
  controls: {
    alignItems: "center",
    paddingBottom: 32,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignSelf: "center",
    marginTop: 20,
  },
  buttonText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semiBold,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.white,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(164, 255, 7, 0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  tapLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.bold,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // ── Modal Styles (Bottom Sheet) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.disabled,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  modalLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 12,
    marginBottom: 6,
    fontFamily: Typography.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.brandDark,
  },
  pickerWrap: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: "hidden",
  },

  // ── Plate Display ──
  plateDisplayWrap: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  plateDisplayLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  plateDisplayText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 24,
    color: Colors.brandDark,
    letterSpacing: 2,
  },

  // ── NFC ──
  nfcSection: {
    marginBottom: 16,
    alignItems: "center",
    width: "100%",
  },
  nfcButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    justifyContent: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  nfcButtonText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: 14,
    color: Colors.brandDark,
  },
  nfcUidText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 16,
    color: Colors.primary,
    textAlign: "center",
    marginTop: 8,
  },

  // ── Vehicle Type ──
  vehicleTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  vtButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  vtButtonActive: {
    backgroundColor: Colors.brandDark,
    borderColor: Colors.brandDark,
  },
  vtButtonText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  vtButtonTextActive: { color: Colors.white },

  // ── Session / Fee ──
  sessionDetails: {
    backgroundColor: Colors.surfaceElevated,
    padding: 14,
    borderRadius: 14,
    marginVertical: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.medium,
  },
  feeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  feeLabel: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  feeValue: {
    fontSize: 22,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.danger,
  },

  // ── Actions ──
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textSecondary,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: "center",
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: {
    color: Colors.brandDark,
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
  },
});
