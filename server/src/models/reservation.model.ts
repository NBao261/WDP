import mongoose, { Schema, Document } from 'mongoose';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  USED = 'used',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface IReservation extends Document {
  code: string;
  userId: mongoose.Types.ObjectId;
  facilityId: mongoose.Types.ObjectId;
  vehicleTypeId: mongoose.Types.ObjectId;
  slotId: mongoose.Types.ObjectId | null;
  licensePlate: string;
  startTime: Date;
  status: ReservationStatus;
  cancellationFee: number;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    code: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'ParkingFacility', required: true },
    vehicleTypeId: { type: Schema.Types.ObjectId, ref: 'VehicleType', required: true },
    slotId: { type: Schema.Types.ObjectId, ref: 'ParkingSlot', default: null },
    licensePlate: { type: String, required: true, uppercase: true, trim: true },
    startTime: { type: Date, required: true },
    status: { type: String, enum: Object.values(ReservationStatus), default: ReservationStatus.PENDING },
    cancellationFee: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

reservationSchema.index({ userId: 1, status: 1 });
reservationSchema.index({ startTime: 1, status: 1 });
reservationSchema.index({ licensePlate: 1, status: 1 });

export const Reservation = mongoose.model<IReservation>('Reservation', reservationSchema);
