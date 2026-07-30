import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
  Modal,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
} from "../../src/constants/theme";
import { SessionDetailCard, FeeEstimate } from "../../src/components";
import { ParkingSession } from "../../src/types/session.types";
import { Reservation } from "../../src/types/reservation.types";
import { sessionApi, reservationApi } from "../../src/services/api";
import { useSocketEvent } from "../../src/hooks/useSocket";

type Tab = "active" | "reserved" | "history";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "active", label: "Đang đỗ", icon: "car-sport" },
  { key: "reserved", label: "Đặt chỗ", icon: "calendar" },
  { key: "history", label: "Lịch sử", icon: "time" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active: {
      label: "Đang đỗ",
      color: '#304f00',
      bg: 'rgba(164, 255, 7, 0.15)',
    },
    pending: {
      label: "Chờ duyệt",
      color: Colors.warning,
      bg: Colors.warningLight,
    },
    confirmed: {
      label: "Xác nhận",
      color: '#304f00',
      bg: 'rgba(164, 255, 7, 0.15)',
    },
    checked_in: {
      label: "Đã check-in",
      color: Colors.primary,
      bg: Colors.primaryBg,
    },
    used: { label: "Đã dùng", color: Colors.success, bg: Colors.successLight },
    completed: {
      label: "Hoàn thành",
      color: Colors.success,
      bg: Colors.successLight,
    },
    cancelled: {
      label: "Đã huỷ",
      color: Colors.danger,
      bg: Colors.dangerLight,
    },
    expired: {
      label: "Hết hạn",
      color: Colors.brandGrayText,
      bg: Colors.brandGray,
    },
  };
  const s = map[status] || {
    label: status,
    color: Colors.brandGrayText,
    bg: Colors.brandGray,
  };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const SessionCard = React.memo(({ item }: { item: ParkingSession }) => {
  const baseFee = (item as any).pricingPlan?.rates?.[0]?.amount || 20000;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View
            style={[styles.plateWrap, { backgroundColor: Colors.primaryBg }]}
          >
            <Text style={styles.plateText}>{item.licensePlate}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.cardTime}>
          {new Date(item.checkInTime).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <View style={styles.cardDetails}>
        <View style={styles.cardDetail}>
          <Ionicons
            name="business-outline"
            size={13}
            color={Colors.textTertiary}
          />
          <Text style={styles.cardDetailText} numberOfLines={1}>
            {item.facilityName}{" "}
            {item.vehicleTypeName ? `• ${item.vehicleTypeName}` : ""}
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Ionicons
            name="location-outline"
            size={13}
            color={Colors.textTertiary}
          />
          <Text style={styles.cardDetailText}>
            {item.floorName} • {item.slotCode}
          </Text>
        </View>
      </View>
      {item.status === "active" && (
        <View style={styles.feeWrap}>
          <FeeEstimate checkInTime={item.checkInTime} baseFee={baseFee} />
        </View>
      )}
      {item.status === "completed" && item.totalFee > 0 && (
        <View style={styles.totalFeeRow}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={styles.totalFeeText}>
            Tổng: {item.totalFee.toLocaleString("vi-VN")}đ
          </Text>
        </View>
      )}
    </View>
  );
});

const ReservationCard2 = React.memo(({
  item,
  onCancel,
}: {
  item: Reservation;
  onCancel: (id: string) => void;
}) => {
  const [showQR, setShowQR] = React.useState(false);
  const checkinAt = new Date(
    (item as any).startTime || (item as any).checkInTime,
  );
  const now = new Date();
  const diffMs = checkinAt.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  const isUpcoming = diffMs > 0;
  const isConfirmed = item.status === "confirmed";
  const isCheckedIn = item.status === "checked_in" || item.status === "used";
  const shouldShowQR = isConfirmed || isCheckedIn;

  let QRCode: any = null;
  try {
    QRCode = require("react-native-qrcode-svg").default;
  } catch {}

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.plateWrap,
              { backgroundColor: Colors.secondaryLight + "18" },
            ]}
          >
            <Text style={[styles.plateText, { color: Colors.secondary }]}>
              {item.licensePlate}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
        {isUpcoming && (
          <View style={styles.countdownWrap}>
            <Text style={styles.countdownText}>
              {diffH}h {diffM}m
            </Text>
            <Text style={styles.countdownLabel}>nữa</Text>
          </View>
        )}
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.cardDetail}>
          <Ionicons
            name="business-outline"
            size={13}
            color={Colors.textTertiary}
          />
          <Text style={styles.cardDetailText} numberOfLines={1}>
            {(item as any).facilityId?.name || "—"}{" "}
            {(item as any).vehicleTypeId?.name
              ? `• ${(item as any).vehicleTypeId.name}`
              : ""}
          </Text>
        </View>
        <View style={styles.cardDetail}>
          <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.cardDetailText}>
            Vào:{" "}
            {checkinAt.toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>

      {/* QR Banner — hiện khi confirmed hoặc checked_in */}
      {shouldShowQR && (item as any).code && (
        <TouchableOpacity
          style={styles.qrBanner}
          onPress={() => setShowQR(true)}
          activeOpacity={0.8}
        >
          <View style={styles.qrLeft}>
            {QRCode ? (
              <QRCode
                value={(item as any).code}
                size={52}
                backgroundColor="transparent"
              />
            ) : (
              <Ionicons
                name="qr-code-outline"
                size={36}
                color={Colors.primary}
              />
            )}
          </View>
          <View style={styles.qrRight}>
            <Text style={styles.qrLabel}>
              Thẻ gửi xe ảo — không cần nhận thẻ
            </Text>
            <Text style={styles.qrCode}>{(item as any).code}</Text>
            <Text style={styles.qrHint}>
              Chạm để phóng to • Dùng khi vào và ra
            </Text>
          </View>
          <Ionicons
            name="expand-outline"
            size={18}
            color={Colors.primary}
            style={{ opacity: 0.7 }}
          />
        </TouchableOpacity>
      )}

      {["pending", "confirmed"].includes(item.status) && !isCheckedIn && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => onCancel(item._id)}
        >
          <Ionicons
            name="close-circle-outline"
            size={16}
            color={Colors.danger}
          />
          <Text style={styles.cancelBtnText}>Huỷ đặt chỗ</Text>
        </TouchableOpacity>
      )}

      {/* Modal QR — dùng React Native Modal để render đúng trên toàn màn hình */}
      {QRCode && (
        <Modal
          visible={showQR}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowQR(false)}
        >
          <StatusBar
            backgroundColor="rgba(0,0,0,0.85)"
            barStyle="light-content"
          />
          <TouchableOpacity
            style={styles.qrModalOverlay}
            activeOpacity={1}
            onPress={() => setShowQR(false)}
          >
            {/* Bấm vào hộp không đóng, chỉ bấm ngoài mới đóng */}
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.qrModalBox}>
                {/* Nút đóng */}
                <TouchableOpacity
                  style={styles.qrModalClose}
                  onPress={() => setShowQR(false)}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={Colors.textSecondary}
                  />
                </TouchableOpacity>

                <Text style={styles.qrModalTitle}>
                  Xuất trình cho nhân viên
                </Text>
                <Text style={styles.qrModalSub}>
                  Đưa mã này khi gửi xe vào và lấy xe ra
                </Text>

                {/* QR Code lớn */}
                <View style={styles.qrModalQrWrap}>
                  <QRCode value={(item as any).code} size={230} />
                </View>

                {/* Mã text */}
                <Text style={styles.qrModalCode}>{(item as any).code}</Text>

                <Text style={styles.qrModalDismiss}>Chạm ra ngoài để đóng</Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
});

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: any;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={32} color={Colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>((initialTab as Tab) || "reserved");
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [histSessions, setHistSessions] = useState<ParkingSession[]>([]);
  const [upcomingRes, setUpcomingRes] = useState<Reservation[]>([]);
  const [histRes, setHistRes] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mapSession = (s: any): ParkingSession => ({
    _id: s._id,
    code: s.code,
    licensePlate: s.licensePlate,
    facilityName: s.facilityId?.name || "—",
    floorName: s.floorId?.name || "",
    slotCode: s.slotId?.code || "",
    vehicleTypeName: s.vehicleTypeId?.name || "",
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime || null,
    status: s.status,
    totalFee: s.totalFee || 0,
    pricingPlan: s.pricingPlanId,
  });

  const fetchData = async (currentTab: Tab) => {
    try {
      if (currentTab === "active") {
        const actRes: any = await sessionApi.getMySessions("active");
        if (actRes?.success) setActiveSessions(actRes.data.map(mapSession));
      } else if (currentTab === "history") {
        const histRes2: any = await sessionApi.getMySessions("completed");
        if (histRes2?.success) setHistSessions(histRes2.data.map(mapSession));
      } else if (currentTab === "reserved") {
        const resRes: any = await reservationApi.getReservations();
        if (resRes?.success) {
          const all: Reservation[] = resRes.data;
          setUpcomingRes(
            all.filter((r) => ["pending", "confirmed", "checked_in", "used"].includes(r.status)),
          );
          setHistRes(
            all.filter((r) =>
              ["cancelled", "expired", "completed"].includes(r.status),
            ),
          );
        }
      }
    } catch (e) {
      console.log("Activity fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData(tab);
    }, [tab]),
  );

  // ─── Socket.io realtime: tự cập nhật khi có sự kiện ───
  useSocketEvent('session:created', () => {
    console.log('[Socket] session:created → refresh');
    fetchData(tab);
  });

  useSocketEvent('session:completed', () => {
    console.log('[Socket] session:completed → refresh');
    fetchData(tab);
  });

  useSocketEvent('reservation:expiring', () => {
    console.log('[Socket] reservation:expiring → refresh');
    fetchData(tab);
  });

  useSocketEvent('reservation:statusChanged', () => {
    console.log('[Socket] reservation:statusChanged → refresh');
    fetchData(tab);
  });
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchData(tab);
  };

  const handleCancelReservation = async (id: string) => {
    try {
      await (reservationApi as any).cancelReservation(id);
      fetchData(tab);
    } catch (e) {
      console.log("Cancel error:", e);
    }
  };

  const renderContent = () => {
    if (loading)
      return (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      );

    if (tab === "active") {
      if (!activeSessions.length)
        return (
          <EmptyState
            icon="car-outline"
            title="Không có xe đang đỗ"
            subtitle="Khi bạn gửi xe, thông tin sẽ hiện ở đây"
            actionLabel="Tìm bãi xe"
            onAction={() => router.push("/(driver)/home" as any)}
          />
        );
      return (
        <FlatList
          data={activeSessions}
          keyExtractor={(i) => i._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <SessionCard item={item} />}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      );
    }

    if (tab === "reserved") {
      const data = [...upcomingRes, ...histRes];
      if (!data.length)
        return (
          <EmptyState
            icon="calendar-outline"
            title="Chưa có đặt chỗ nào"
            subtitle="Đặt trước chỗ đỗ để đảm bảo có chỗ khi cần"
            actionLabel="Đặt chỗ ngay"
            onAction={() => router.push("/(driver)/reservations" as any)}
          />
        );
      return (
        <FlatList
          data={data}
          keyExtractor={(i) => i._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ReservationCard2 item={item} onCancel={handleCancelReservation} />
          )}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      );
    }

    // history tab
    if (!histSessions.length)
      return (
        <EmptyState
          icon="time-outline"
          title="Chưa có lịch sử"
          subtitle="Lượt gửi xe đã hoàn thành sẽ hiện ở đây"
        />
      );
    return (
      <FlatList
        data={histSessions}
        keyExtractor={(i) => i._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <SessionCard item={item} />}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    );
  };

  return (
    <View style={styles.root}>
      {/* Header — White like reference */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.white }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hoạt động</Text>
        </View>
      </SafeAreaView>

      {/* Segmented control — like reference ActivityTab */}
      <View style={styles.segmentedWrap}>
        <View style={styles.segmentedBg}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.segmentedItem, tab === t.key && styles.segmentedItemActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.segmentedLabel, tab === t.key && styles.segmentedLabelActive]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  // Header — white flat
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandGray,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },

  // Segmented control — reference pattern
  segmentedWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedBg: {
    flexDirection: 'row',
    backgroundColor: Colors.brandGray,
    borderRadius: 9999,
    padding: 3,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  segmentedItemActive: {
    backgroundColor: Colors.brandDark,
  },
  segmentedLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandGrayText,
  },
  segmentedLabelActive: {
    color: Colors.brandLime,
  },

  content: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },

  // Card — white with gray border, rounded-24
  card: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.brandGray,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plateWrap: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.brandGray,
  },
  plateText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    letterSpacing: 1.5,
  },
  cardTime: {
    fontSize: 12,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.bold,
  },

  cardDetails: { gap: 4 },
  cardDetail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardDetailText: {
    fontSize: 12,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.semiBold,
    flex: 1,
  },

  feeWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.brandGray,
    paddingTop: 10,
  },
  totalFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  totalFeeText: {
    fontSize: 13,
    color: Colors.success,
    fontFamily: Typography.fontFamily.semiBold,
  },

  // Badge — pill
  badge: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontFamily: Typography.fontFamily.bold, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Countdown
  countdownWrap: { alignItems: 'flex-end' },
  countdownText: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.warning,
  },
  countdownLabel: {
    fontSize: 10,
    color: Colors.brandGrayText,
    fontFamily: Typography.fontFamily.medium,
  },

  // Cancel — rose pill like reference
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.20)',
    borderRadius: 9999,
  },
  cancelBtnText: {
    fontSize: 12,
    color: Colors.danger,
    fontFamily: Typography.fontFamily.bold,
  },

  // Empty — reference pattern
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brandGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.brandGrayText,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 240,
  },
  emptyAction: {
    marginTop: 20,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 14,
    ...Shadows.sm,
  },
  emptyActionText: {
    color: Colors.brandDark,
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
  },

  // QR Banner — dark like reference
  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    backgroundColor: Colors.brandDark,
    borderRadius: 16,
    padding: 12,
  },
  qrLeft: {
    width: 52,
    height: 52,
    backgroundColor: Colors.white,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrRight: { flex: 1 },
  qrLabel: {
    fontSize: 10,
    color: Colors.brandLime,
    fontFamily: Typography.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  qrCode: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  qrHint: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: Typography.fontFamily.bold,
    marginTop: 2,
  },

  // QR Modal (React Native Modal — flex layout, bao phủ toàn màn hình)
  qrModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  qrModalBox: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  qrModalClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  qrModalTitle: {
    fontSize: 17,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  qrModalSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    marginBottom: 20,
  },
  qrModalQrWrap: {
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  qrModalCode: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
    letterSpacing: 2.5,
    marginBottom: 16,
  },
  qrModalInfo: {
    width: "100%",
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 14,
  },
  qrModalInfoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qrModalInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.regular,
    flex: 1,
  },
  qrModalDismiss: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: Typography.fontFamily.regular,
    marginTop: 14,
  },
});
