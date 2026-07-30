import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Reservation, ReservationStatus } from '../types/reservation.types';
import Button from './Button';
import Badge from './Badge';

interface Props {
  reservation: Reservation;
  onCancel?: (id: string) => void;
  cancellingId?: string | null;
}

const getStatusBadge = (status: ReservationStatus) => {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return <Badge label="Đã xác nhận" variant="success" />;
    case 'checked_in':
      return <Badge label="Đã check-in" variant="info" />;
    case 'used':
      return <Badge label="Đã sử dụng" variant="info" />;
    case 'completed':
      return <Badge label="Hoàn thành" variant="success" />;
    case 'cancelled':
      return <Badge label="Đã hủy" variant="danger" />;
    case 'expired':
      return <Badge label="Quá hạn" variant="warning" />;
    default:
      return <Badge label={status} variant="neutral" />;
  }
};

const getVehicleIcon = (typeName?: string): any => {
  if (!typeName) return 'car-outline';
  const n = typeName.toLowerCase();
  if (n.includes('ô tô') || n.includes('car')) return 'car-sport-outline';
  if (n.includes('xe tải') || n.includes('truck')) return 'bus-outline';
  return 'bicycle-outline';
};

export default function ReservationCard({ reservation, onCancel, cancellingId }: Props) {
  const canCancel = ['pending', 'confirmed'].includes(reservation.status);

  // Extract vehicle type name safely — handle both populated object and plain string
  const vtObj = reservation.vehicleTypeId as any;
  const vehicleTypeName: string = vtObj?.name || (typeof vtObj === 'string' ? vtObj : '---');

  // Parse time
  const startDate = new Date(reservation.startTime);
  const timeStr = startDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).replace(/[\u202F\u00A0]/g, ' ');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = startDate.toDateString() === today.toDateString();
  const isTomorrow = startDate.toDateString() === tomorrow.toDateString();
  const dateLabel = isToday
    ? 'Hôm nay'
    : isTomorrow
    ? 'Ngày mai'
    : startDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).replace(/[\u202F\u00A0]/g, ' ');

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.codeIconWrap}>
            <Ionicons name="ticket-outline" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.code}>{reservation.code}</Text>
        </View>
        {getStatusBadge(reservation.status)}
      </View>

      <View style={styles.divider} />

      {/* ── Bãi đỗ xe ── */}
      <View style={styles.infoRow}>
        <View style={[styles.infoIconWrap, { backgroundColor: Colors.primaryBg }]}>
          <Ionicons name="business" size={16} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoLabel}>Bãi đỗ xe</Text>
          <Text style={styles.infoValue}>{reservation.facilityId?.name || '---'}</Text>
        </View>
      </View>

      {/* ── Loại xe ── */}
      <View style={styles.infoRow}>
        <View style={[styles.infoIconWrap, { backgroundColor: (Colors.secondaryLight || '#E8F5E9') + '30' }]}>
          <Ionicons name={getVehicleIcon(vehicleTypeName)} size={16} color={Colors.secondary || '#4CAF50'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoLabel}>Loại xe</Text>
          <Text style={styles.infoValue}>{vehicleTypeName}</Text>
        </View>
      </View>

      {/* ── Biển số ── */}
      <View style={styles.infoRow}>
        <View style={[styles.infoIconWrap, { backgroundColor: '#E3F2FD' }]}>
          <Ionicons name="newspaper-outline" size={16} color={Colors.info || '#2196F3'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoLabel}>Biển số xe</Text>
          <Text style={[styles.infoValue, styles.plateText]}>{reservation.licensePlate}</Text>
        </View>
      </View>

      {/* ── Thời gian dự kiến ── */}
      <View style={styles.timeRow}>
        <View style={styles.timeIconWrap}>
          <Ionicons name="time" size={16} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.timeLabel}>Dự kiến vào bãi</Text>
          <Text style={styles.timeValue}>
            {timeStr}
            <Text style={styles.timeDate}>{' · '}{dateLabel}</Text>
          </Text>
        </View>
      </View>

      {/* ── Vị trí đỗ ── */}
      {reservation.slotId && (
        <View style={styles.slotRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
          <Text style={styles.slotLabel}>Vị trí đỗ:</Text>
          <View style={styles.slotBadge}>
            <Text style={styles.slotCode}>{reservation.slotId.code}</Text>
          </View>
        </View>
      )}

      {/* ── Footer ── */}
      {canCancel && onCancel && (
        <View style={styles.footer}>
          <Button
            title="Hủy đặt chỗ"
            variant="outline"
            size="sm"
            fullWidth
            onPress={() => onCancel(reservation._id)}
            loading={cancellingId === reservation._id}
          />
          <Text style={styles.noteText}>
            Hệ thống sẽ tự hủy nếu quá 30 phút sau giờ bắt đầu mà xe chưa vào bãi.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginBottom: 14,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary,
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  plateText: {
    letterSpacing: 1,
    fontFamily: Typography.fontFamily.bold,
  },

  // Time row
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '18',
  },
  timeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLabel: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 16,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },
  timeDate: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },

  // Slot
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  slotLabel: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textTertiary,
  },
  slotBadge: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  slotCode: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.primary,
  },

  // Footer
  footer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 8,
  },
  noteText: {
    fontSize: 11,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
