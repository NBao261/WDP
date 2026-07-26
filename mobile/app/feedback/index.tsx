import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography, Shadows } from "../../src/constants/theme";
import { exceptionApi } from "../../src/services/api";

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    new:        { label: "Chờ xử lý",    color: Colors.warning,       bg: Colors.warningLight,  icon: "time-outline" },
    processing: { label: "Đang xử lý",   color: Colors.brandDark,     bg: Colors.primaryBg,     icon: "sync-outline" },
    resolved:   { label: "Đã xử lý",     color: Colors.success,       bg: Colors.successLight,  icon: "checkmark-circle-outline" },
    rejected:   { label: "Từ chối",       color: Colors.danger,        bg: Colors.dangerLight,   icon: "close-circle-outline" },
  };
  const s = map[status] || { label: status, color: Colors.brandGrayText, bg: Colors.brandGray, icon: "ellipse-outline" };
  return (
    <View style={[styles.chip, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={11} color={s.color} />
      <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function TypeLabel({ type }: { type: string }) {
  const map: Record<string, string> = {
    lost_card:    "Mất thẻ/Vé",
    wrong_fee:    "Sai phí",
    wrong_plate:  "Sai biển số",
    wrong_zone:   "Sai khu vực đỗ",
    unpaid:       "Chưa thanh toán",
    other:        "Khác",
  };
  return <Text style={styles.typeLabel}>{map[type] || type}</Text>;
}

export default function FeedbackListScreen() {
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeedbacks = async () => {
    try {
      const res: any = await exceptionApi.getMyReports();
      if (res.success) setFeedbacks(res.data || []);
    } catch (e) {
      console.log("Error fetching feedbacks", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchFeedbacks(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchFeedbacks(); };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.timelineRow}>
      {/* Timeline line */}
      <View style={styles.timelineLeft}>
        <View style={[styles.dot, {
          backgroundColor: item.status === 'resolved' ? Colors.success :
            item.status === 'processing' ? Colors.brandLime : Colors.brandGrayText
        }]} />
        {index < feedbacks.length - 1 && <View style={styles.line} />}
      </View>
      {/* Card */}
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <TypeLabel type={item.type} />
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString("vi-VN", {
                day: "2-digit", month: "2-digit", year: "numeric",
              })}
            </Text>
          </View>
          <StatusChip status={item.status} />
        </View>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        
        {/* Thông báo kết quả xử lý (nếu có dời chỗ đỗ / đổi biển số) */}
        {item.status === 'resolved' && (
          <View>
            {item.type === 'wrong_zone' && item.newSlot && (
              <View style={[styles.responseBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeftColor: Colors.danger }]}>
                <View style={styles.responseHeader}>
                  <Ionicons name="swap-horizontal-outline" size={14} color={Colors.danger} />
                  <Text style={[styles.responseBy, { color: Colors.danger }]}>Thông báo dời xe</Text>
                </View>
                <Text style={styles.responseNote}>
                  Quản lý đã dời xe của bạn từ vị trí <Text style={{fontWeight: 'bold'}}>{item.oldSlot?.code || item.oldSlot?.name || 'cũ'}</Text> sang vị trí mới là <Text style={{fontWeight: 'bold'}}>{item.newSlot?.code || item.newSlot?.name}</Text>. Vui lòng kiểm tra lại!
                </Text>
              </View>
            )}
            
            {item.type === 'wrong_plate' && item.sessionId?.licensePlate && (
              <View style={[styles.responseBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderLeftColor: '#3b82f6' }]}>
                <View style={styles.responseHeader}>
                  <Ionicons name="car-sport-outline" size={14} color="#3b82f6" />
                  <Text style={[styles.responseBy, { color: '#3b82f6' }]}>Cập nhật biển số</Text>
                </View>
                <Text style={styles.responseNote}>
                  Biển số của bạn đã được cập nhật lại thành <Text style={{fontWeight: 'bold'}}>{item.sessionId.licensePlate}</Text>.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Lời nhắn từ Staff/Manager */}
        {item.staffNote && (
          <View style={styles.responseBox}>
            <View style={styles.responseHeader}>
              <Ionicons name="person-circle-outline" size={14} color={Colors.brandDark} />
              <Text style={styles.responseBy}>Phản hồi từ quản lý</Text>
            </View>
            <Text style={styles.responseNote}>{item.staffNote}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.white }}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.brandDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Phản hồi của tôi</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/feedback/create" as any)}
          >
            <Ionicons name="add" size={20} color={Colors.brandDark} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <ActivityIndicator color={Colors.brandLime} style={{ marginTop: 60 }} />
      ) : feedbacks.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubble-outline" size={32} color={Colors.brandGrayText} />
          </View>
          <Text style={styles.emptyTitle}>Chưa có phản hồi nào</Text>
          <Text style={styles.emptySub}>Gửi phản hồi để chúng tôi cải thiện dịch vụ</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/feedback/create" as any)}>
            <Ionicons name="add-circle-outline" size={16} color={Colors.brandDark} />
            <Text style={styles.emptyBtnText}>Gửi phản hồi mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={feedbacks}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.brandGray,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandLime,
    alignItems: "center",
    justifyContent: "center",
  },

  list: { padding: 16, paddingBottom: 32 },

  // Timeline
  timelineRow: { flexDirection: "row", marginBottom: 4 },
  timelineLeft: { width: 28, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 18, zIndex: 1 },
  line: { width: 2, flex: 1, backgroundColor: Colors.brandGray, marginTop: 4, alignSelf: "center" },

  // Card
  card: {
    flex: 1, marginLeft: 10, marginBottom: 16,
    backgroundColor: Colors.white,
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: Colors.brandGray,
    ...Shadows.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  dateText: { fontSize: 11, color: Colors.brandGrayText, fontFamily: Typography.fontFamily.regular, marginTop: 2 },
  description: { fontSize: 13, color: Colors.brandDark, fontFamily: Typography.fontFamily.regular, lineHeight: 20 },

  // Type
  typeLabel: { fontSize: 13, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark },

  // Status chip
  chip: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 10, fontFamily: Typography.fontFamily.bold },

  // Response
  responseBox: {
    marginTop: 10, padding: 10, backgroundColor: 'rgba(164, 255, 7, 0.10)',
    borderRadius: 10, borderLeftWidth: 3, borderLeftColor: Colors.brandLime,
  },
  responseHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  responseBy: { fontSize: 11, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark },
  responseNote: { fontSize: 12, color: Colors.brandDark, lineHeight: 18 },

  // Empty
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.brandGray,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 14, fontFamily: Typography.fontFamily.bold, color: Colors.brandDark, marginBottom: 6 },
  emptySub: { fontSize: 12, color: Colors.brandGrayText, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  emptyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.brandLime, borderRadius: 9999, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.brandDark, fontSize: 13, fontFamily: Typography.fontFamily.bold },
});
