import React, { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Colors, Typography, Spacing } from "../../src/constants/theme";
import { ReservationCard } from "../../src/components";
import { Reservation } from "../../src/types/reservation.types";
import { reservationApi } from "../../src/services/api";

export default function ReservationsScreen() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">(
    "upcoming",
  );
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchReservations = async () => {
    try {
      const response = (await reservationApi.getReservations()) as any;
      if (response.success) {
        const allReservations: Reservation[] = response.data;

        // Phân loại Đặt chỗ
        const up = allReservations.filter((r) =>
          ["pending", "confirmed"].includes(r.status),
        );
        const hist = allReservations.filter((r) =>
          ["used", "cancelled", "expired"].includes(r.status),
        );

        setUpcoming(up);
        setHistory(hist);
      }
    } catch (error) {
      console.log("Error fetching reservations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReservations();
    }, []),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReservations();
  }, []);

  const handleCancel = async (id: string) => {
    Alert.alert(
      "Xác nhận hủy",
      "Bạn có chắc muốn hủy đặt chỗ này không?",
      [
        { text: "Không", style: "cancel" },
        {
          text: "Hủy đặt chỗ",
          style: "destructive",
          onPress: async () => {
            setCancellingId(id);
            try {
              const response = (await reservationApi.cancelReservation(id)) as any;
              if (response.success) {
                fetchReservations();
              }
            } catch (error) {
              Alert.alert("Lỗi", "Không thể hủy đặt chỗ. Vui lòng thử lại.");
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const renderEmptyState = (title: string, subtitle: string) => (
    <View style={styles.emptyState}>
      <Ionicons
        name="calendar-outline"
        size={64}
        color={Colors.brandGrayText}
        style={{ marginBottom: 16 }}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderContent = () => {
    if (loading && !refreshing) {
      return <ActivityIndicator style={styles.loader} color={Colors.brandDark} />;
    }

    const currentData = activeTab === "upcoming" ? upcoming : history;

    if (currentData.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderEmptyState(
            activeTab === "upcoming"
              ? "Không có đặt chỗ nào sắp tới"
              : "Chưa có lịch sử đặt chỗ",
            activeTab === "upcoming"
              ? "Các đặt chỗ chờ xác nhận hoặc đã xác nhận sẽ hiển thị ở đây"
              : "Các đặt chỗ đã hoàn thành, quá hạn hoặc bị hủy sẽ hiển thị ở đây",
          )}
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={currentData}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <ReservationCard
            reservation={item}
            onCancel={handleCancel}
            cancellingId={cancellingId}
          />
        )}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.segmentContainer}>
        <View style={styles.segmentControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === "upcoming" && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveTab("upcoming")}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === "upcoming" && styles.segmentTextActive,
              ]}
            >
              Sắp tới
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === "history" && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === "history" && styles.segmentTextActive,
              ]}
            >
              Lịch sử
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>{renderContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentControl: {
    flexDirection: "row",
    backgroundColor: Colors.brandGray,
    borderRadius: 9999,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9999,
  },
  segmentButtonActive: {
    backgroundColor: Colors.brandDark,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandGrayText,
  },
  segmentTextActive: {
    color: Colors.brandLime,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyScroll: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.brandDark,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.brandGrayText,
    marginTop: 6,
    textAlign: "center",
    maxWidth: 240,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
});
