import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Image,
} from "react-native";
import { useRouter, Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Typography, Shadows } from "../../src/constants/theme";
import { vehicleApi } from "../../src/services/api";

interface VehicleItem {
  _id: string;
  licensePlate: string;
  nickname: string;
  image: string;
  isDefault: boolean;
  isInUse: boolean;
  inUseReason: string;
  vehicleTypeId: { _id: string; name: string; code: string; icon: string } | null;
}

const getVehicleIcon = (code?: string): any => {
  if (!code) return "car-outline";
  const lower = code.toLowerCase();
  if (lower.includes("moto") || lower.includes("bike") || lower.includes("xm")) return "bicycle-outline";
  if (lower.includes("truck")) return "bus-outline";
  return "car-sport-outline";
};

const VehicleCard = React.memo(({
  item,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  item: VehicleItem;
  onEdit: (v: VehicleItem) => void;
  onDelete: (v: VehicleItem) => void;
  onSetDefault: (v: VehicleItem) => void;
}) => {
  const vtName = item.vehicleTypeId?.name || "Không rõ";
  const vtCode = item.vehicleTypeId?.code || "";

  return (
    <TouchableOpacity
      style={[styles.card, item.isInUse && styles.cardInUse]}
      activeOpacity={0.85}
      onLongPress={() => onDelete(item)}
      onPress={() => onEdit(item)}
    >
      {/* Image or icon */}
      <View style={styles.cardImageWrap}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardIconFallback}>
            <Ionicons
              name={getVehicleIcon(vtCode)}
              size={28}
              color={Colors.brandGrayText}
            />
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        {/* Plate */}
        <Text style={styles.plateText}>{item.licensePlate}</Text>

        {/* Type */}
        <View style={styles.typeRow}>
          <Ionicons name={getVehicleIcon(vtCode)} size={13} color={Colors.brandGrayText} />
          <Text style={styles.typeText}>{vtName}</Text>
        </View>

        {/* Nickname */}
        {!!item.nickname && (
          <Text style={styles.nicknameText}>"{item.nickname}"</Text>
        )}

        {/* Badges */}
        <View style={styles.badgesRow}>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Ionicons name="star" size={10} color={Colors.brandDark} />
              <Text style={styles.defaultBadgeText}>Mặc định</Text>
            </View>
          )}
          {item.isInUse && (
            <View style={styles.inUseBadge}>
              <Ionicons name="lock-closed" size={10} color={Colors.brandDark} />
              <Text style={styles.inUseBadgeText}>{item.inUseReason || 'Đang sử dụng'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.cardActions}>
        {!item.isDefault && !item.isInUse && (
          <TouchableOpacity
            onPress={() => onSetDefault(item)}
            style={styles.actionBtn}
          >
            <Ionicons name="star-outline" size={14} color="#f59e0b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => onEdit(item)}
          style={styles.actionBtn}
          disabled={item.isInUse}
        >
          <Ionicons name="create-outline" size={14} color={item.isInUse ? Colors.disabled : Colors.brandDark} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(item)}
          style={styles.actionBtn}
          disabled={item.isInUse}
        >
          <Ionicons name="trash-outline" size={14} color={item.isInUse ? Colors.disabled : Colors.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

export default function MyVehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await vehicleApi.getMyVehicles();
      if (res.success) {
        setVehicles(res.data);
      }
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles])
  );

  const handleDelete = useCallback((vehicle: VehicleItem) => {
    if (vehicle.isInUse) {
      Alert.alert(
        "Không thể xoá",
        `${vehicle.inUseReason}. Vui lòng hoàn tất trước khi xoá xe.`
      );
      return;
    }
    Alert.alert(
      "Xoá xe",
      `Bạn có chắc muốn xoá xe biển số "${vehicle.licensePlate}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            try {
              await vehicleApi.deleteVehicle(vehicle._id);
              loadVehicles(); // Reload từ server để đồng bộ isDefault, isInUse
            } catch (err: any) {
              Alert.alert("Lỗi", err.message || "Không thể xoá xe");
            }
          },
        },
      ]
    );
  }, []);

  const handleSetDefault = async (vehicle: VehicleItem) => {
    if (vehicle.isDefault) return;
    try {
      await vehicleApi.updateVehicle(vehicle._id, { isDefault: true });
      setVehicles((prev) =>
        prev.map((v) => ({ ...v, isDefault: v._id === vehicle._id }))
      );
    } catch (err: any) {
      Alert.alert("Lỗi", err.message || "Không thể cập nhật");
    }
  };

  const handleEdit = useCallback((vehicle: VehicleItem) => {
    if (vehicle.isInUse) {
      Alert.alert(
        "Không thể chỉnh sửa",
        `${vehicle.inUseReason}. Vui lòng hoàn tất trước khi chỉnh sửa xe.`
      );
      return;
    }
    router.push(`/profile/edit-vehicle?id=${vehicle._id}` as any);
  }, [router]);

  const renderVehicle = useCallback(({ item }: { item: VehicleItem }) => (
    <VehicleCard item={item} onEdit={handleEdit} onDelete={handleDelete} onSetDefault={handleSetDefault} />
  ), [handleEdit, handleDelete, handleSetDefault]);

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="car-outline" size={48} color={Colors.brandGrayText} />
      </View>
      <Text style={styles.emptyTitle}>Chưa có xe nào</Text>
      <Text style={styles.emptySubtitle}>
        Thêm phương tiện để bắt đầu trải nghiệm đỗ xe thông minh.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => router.push("/profile/add-vehicle" as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={16} color={Colors.brandDark} />
        <Text style={styles.emptyBtnText}>Thêm xe đầu tiên</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* Header */}
        <SafeAreaView edges={["top"]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.brandDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Xe của tôi</Text>
            <TouchableOpacity
              onPress={() => router.push("/profile/add-vehicle" as any)}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color={Colors.brandDark} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Vehicle List */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.brandLime} />
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item._id}
            renderItem={renderVehicle}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    textAlign: "center",
    flex: 1,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brandLime,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },

  // List
  listContent: { padding: 16, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.brandGray,
    ...Shadows.sm,
  },
  cardInUse: {
    opacity: 0.6,
  },
  cardImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: "hidden",
    marginRight: 14,
    borderWidth: 1,
    borderColor: Colors.brandGray,
  },
  cardImage: { width: 56, height: 56, borderRadius: 14 },
  cardIconFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 2 },
  plateText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  typeText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.brandGrayText,
  },
  nicknameText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.brandGrayText,
    fontStyle: "italic",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: 'rgba(164, 255, 7, 0.20)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  inUseBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.brandGray,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inUseBadgeText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.brandDark,
  },
  cardActions: {
    gap: 6,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.brandGray,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.brandGrayText,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 200,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.brandLime,
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...Shadows.sm,
  },
  emptyBtnText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
});
