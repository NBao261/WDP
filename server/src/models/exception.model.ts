import mongoose, { Schema, Document } from 'mongoose';

export enum ExceptionType {
  LOST_CARD = 'lost_card',
  WRONG_PLATE = 'wrong_plate',
  WRONG_FEE = 'wrong_fee',
  OVERTIME = 'overtime',
  WRONG_ZONE = 'wrong_zone',
  UNPAID = 'unpaid',
  OTHER = 'other',
}

export enum ExceptionSource {
  STAFF = 'staff',
  DRIVER = 'driver',
  SYSTEM = 'system',
}

export enum ExceptionStatus {
  NEW = 'new',
  RESOLVED = 'resolved',
}

export interface IException extends Document {
  sessionId: mongoose.Types.ObjectId;
  type: ExceptionType;
  description: string;
  source: ExceptionSource;                            // Nguồn tạo exception
  staffId: mongoose.Types.ObjectId | null;            // Staff tạo exception (nếu do staff)
  driverId: mongoose.Types.ObjectId | null;           // Driver tạo exception (nếu do driver)
  images: string[];                                   // Ảnh đính kèm từ driver

  resolvedByStaffId: mongoose.Types.ObjectId | null;  // Staff xử lý exception
  staffNote: string;                                  // Ghi chú xử lý của staff
  managerId: mongoose.Types.ObjectId | null;          // Manager review (optional)
  managerNote: string;                                // Ghi chú của manager
  surcharge: number;
  status: ExceptionStatus;
  actualPlate?: string;
  expectedPlate?: string;
  checkInImage?: string;
  checkOutImage?: string;
  cardCode?: string;
  oldSlot?: mongoose.Types.ObjectId;
  newSlot?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const exceptionSchema = new Schema<IException>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ParkingSession', required: true },
    type: { type: String, enum: Object.values(ExceptionType), required: true },
    description: { type: String, required: true },
    source: { type: String, enum: Object.values(ExceptionSource), default: ExceptionSource.STAFF },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    driverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    images: [{ type: String }],

    resolvedByStaffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    staffNote: { type: String, default: '' },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    managerNote: { type: String, default: '' },
    surcharge: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(ExceptionStatus), default: ExceptionStatus.NEW },
    actualPlate: { type: String },
    expectedPlate: { type: String },
    checkInImage: { type: String },
    checkOutImage: { type: String },
    cardCode: { type: String },
    oldSlot: { type: Schema.Types.ObjectId, ref: 'ParkingSlot' },
    newSlot: { type: Schema.Types.ObjectId, ref: 'ParkingSlot' },
  },
  { timestamps: true }
);

exceptionSchema.index({ sessionId: 1 });
exceptionSchema.index({ type: 1, status: 1 });

export const Exception = mongoose.model<IException>('Exception', exceptionSchema);
