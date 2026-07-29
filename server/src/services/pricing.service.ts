import { PricingPlan, IPricingPlan, FeeMethod } from '../models/pricingPlan.model';
import { VehicleType } from '../models/vehicleType.model';
import { ParkingFacility } from '../models/parkingFacility.model';
import { ParkingSession } from '../models/parkingSession.model';
import { AppError } from '../middlewares/error.middleware';
import { delCache } from '../config/redis';

function getTimeWindowIntervals(rates: Array<{ startTime?: string; endTime?: string }>): Array<[number, number]> {
  const intervals: Array<[number, number]> = [];
  for (const rate of rates) {
    if (!rate.startTime || !rate.endTime) continue;
    const [sH, sM] = rate.startTime.split(':').map(Number);
    const [eH, eM] = rate.endTime.split(':').map(Number);
    const start = sH * 60 + sM;
    const end = eH * 60 + eM;
    if (start < end) {
      intervals.push([start, end]);
    } else if (start > end) {
      intervals.push([start, 1440]);
      intervals.push([0, end]);
    }
  }
  return intervals.sort((a, b) => a[0] - b[0]);
}

function validateTimeWindowCoverage(
  rates: Array<{ startTime?: string; endTime?: string }>,
  openTime: string,
  closeTime: string
): void {
  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);
  const openMin = oH * 60 + oM;
  const closeMin = cH * 60 + cM;
  const is24h = openMin === closeMin;

  let operatingMinutes: number;
  let operatingIntervals: Array<[number, number]>;

  if (is24h) {
    operatingMinutes = 1440;
    operatingIntervals = [[0, 1440]];
  } else if (openMin < closeMin) {
    operatingMinutes = closeMin - openMin;
    operatingIntervals = [[openMin, closeMin]];
  } else {
    operatingMinutes = (1440 - openMin) + closeMin;
    operatingIntervals = [[openMin, 1440], [0, closeMin]];
  }

  const rateIntervals = getTimeWindowIntervals(rates);
  const rateMinutes = rateIntervals.reduce((sum, [s, e]) => sum + (e - s), 0);

  if (rateMinutes !== operatingMinutes) {
    throw new AppError(
      `Các khung giờ phải phủ kín giờ hoạt động (${openTime} - ${closeTime} = ${operatingMinutes} phút). Hiện tại rates chỉ phủ ${rateMinutes} phút.`,
      400
    );
  }

  for (const [rStart, rEnd] of rateIntervals) {
    const isWithinOperating = operatingIntervals.some(
      ([oStart, oEnd]) => rStart >= oStart && rEnd <= oEnd
    );
    if (!isWithinOperating) {
      const rStartStr = `${String(Math.floor(rStart / 60)).padStart(2, '0')}:${String(rStart % 60).padStart(2, '0')}`;
      const rEndStr = rEnd === 1440 ? '00:00' : `${String(Math.floor(rEnd / 60)).padStart(2, '0')}:${String(rEnd % 60).padStart(2, '0')}`;
      throw new AppError(
        `Khung giờ ${rStartStr}-${rEndStr} vượt ngoài giờ hoạt động (${openTime} - ${closeTime}). Ngoài giờ hoạt động sẽ tính theo phí quá giờ (overtimeFeePerHour).`,
        400
      );
    }
  }
}

export class PricingService {
  static async createPricingPlan(data: Partial<IPricingPlan>): Promise<IPricingPlan> {
    const vehicleType = await VehicleType.findById(data.vehicleTypeId);
    if (!vehicleType || vehicleType.isDeleted) {
      throw new AppError('Loại phương tiện không tồn tại hoặc đã bị xoá', 400);
    }

    const facility = await ParkingFacility.findById(data.facilityId);
    if (!facility) {
      throw new AppError('Bãi xe không tồn tại', 400);
    }

    if (!data.feeMethod) {
      if (data.feeType === 'per_turn') {
        data.feeMethod = FeeMethod.FLAT_RATE;
      } else {
        data.feeMethod = FeeMethod.DURATION_BASED;
      }
    }

    if (data.feeMethod === FeeMethod.TIME_WINDOW && data.rates) {
      validateTimeWindowCoverage(data.rates, facility.openTime, facility.closeTime);
    }

    if (data.status !== 'inactive') {
      await PricingPlan.updateMany(
        { facilityId: data.facilityId, vehicleTypeId: data.vehicleTypeId, status: 'active' },
        { status: 'inactive' }
      );
    }

    const newPlan = new PricingPlan(data);
    await newPlan.save();

    if (newPlan.status === 'active') {
      await delCache(`pricing:active:${newPlan.facilityId}:${newPlan.vehicleTypeId}`);
    }

    return newPlan;
  }

  static async updatePricingPlan(id: string, data: Partial<IPricingPlan>): Promise<IPricingPlan | null> {

    const planToUpdate = await PricingPlan.findById(id);
    if (!planToUpdate) {
      throw new AppError('Pricing plan not found', 404);
    }

    const pricingAffectingFields: (keyof IPricingPlan)[] = [
      'rates', 'feeType', 'feeMethod', 'overnightFee', 'overtimeFeePerHour',
      'firstBlockHours', 'maxDailyFee', 'gracePeriodMinutes', 'lostCardFee',
    ];
    
    let isModifyingPricing = false;
    for (const field of pricingAffectingFields) {
      if (field in data) {
        if (field === 'rates') {
          const newRates = (data.rates || []).map((r: any) => ({
            label: r.label, amount: Number(r.amount), unit: r.unit, startTime: r.startTime || undefined, endTime: r.endTime || undefined
          }));
          const oldRates = planToUpdate.rates.map(r => ({
            label: r.label, amount: Number(r.amount), unit: r.unit, startTime: r.startTime || undefined, endTime: r.endTime || undefined
          }));
          if (JSON.stringify(newRates) !== JSON.stringify(oldRates)) {
            isModifyingPricing = true;
            break;
          }
        } else {
          let newVal = data[field];
          let oldVal = planToUpdate[field as keyof IPricingPlan];
          
          if (newVal === '' || newVal === null) newVal = undefined;
          if (oldVal === null) oldVal = undefined;
          
          if (String(newVal) !== String(oldVal)) {
            isModifyingPricing = true;
            break;
          }
        }
      }
    }

    if (isModifyingPricing) {
      const activeSessionCount = await ParkingSession.countDocuments({
        pricingPlanId: id,
        status: { $in: ['active', 'exception'] },
      });

      if (activeSessionCount > 0) {
        throw new AppError(
          `Không thể chỉnh sửa thông tin giá vì hiện có ${activeSessionCount} lượt gửi xe đang sử dụng bảng giá này. Bạn chỉ có thể đổi tên bảng giá. Vui lòng đợi tất cả xe ra bãi hoặc tạo bảng giá mới.`,
          400
        );
      }
    }

    const effectiveFeeMethod = data.feeMethod || (await PricingPlan.findById(id))?.feeMethod;
    if (effectiveFeeMethod === FeeMethod.TIME_WINDOW && data.rates) {
      const planForFacility = await PricingPlan.findById(id);
      if (planForFacility) {
        const facility = await ParkingFacility.findById(planForFacility.facilityId);
        if (facility) {
          validateTimeWindowCoverage(data.rates, facility.openTime, facility.closeTime);
        }
      }
    }

    if (data.status === 'active') {
      await PricingPlan.updateMany(
        { facilityId: planToUpdate.facilityId, vehicleTypeId: planToUpdate.vehicleTypeId, _id: { $ne: id }, status: 'active' },
        { status: 'inactive' }
      );
    } else if (data.status === 'inactive' || data.isDeleted) {
      if (planToUpdate.status === 'active') {
        const activeCount = await PricingPlan.countDocuments({
          facilityId: planToUpdate.facilityId,
          vehicleTypeId: planToUpdate.vehicleTypeId,
          status: 'active',
          _id: { $ne: id }
        });
        if (activeCount === 0) {
          throw new AppError('Không thể vô hiệu hoá bảng giá này vì đây là bảng giá active duy nhất cho loại xe tại bãi xe này', 400);
        }
      }
    }

    const updatedPlan = await PricingPlan.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updatedPlan) {
      throw new AppError('Pricing plan not found', 404);
    }

    await delCache(`pricing:active:${updatedPlan.facilityId}:${updatedPlan.vehicleTypeId}`);

    return updatedPlan;
  }

  static async deletePricingPlan(id: string): Promise<IPricingPlan | null> {
    const activeSessionCount = await ParkingSession.countDocuments({
      pricingPlanId: id,
      status: { $in: ['active', 'exception'] },
    });

    if (activeSessionCount > 0) {
      throw new AppError(
        `Không thể xoá bảng giá này vì hiện có ${activeSessionCount} lượt gửi xe đang sử dụng. Vui lòng đợi tất cả xe ra bãi hoặc chuyển sang vô hiệu hoá.`,
        400
      );
    }

    const plan = await PricingPlan.findByIdAndUpdate(id, { isDeleted: true, status: 'inactive' }, { new: true });
    if (!plan) {
      throw new AppError('Pricing plan not found', 404);
    }

    await delCache(`pricing:active:${plan.facilityId}:${plan.vehicleTypeId}`);

    return plan;
  }

  static async getPricingPlanById(id: string): Promise<IPricingPlan | null> {
    const plan = await PricingPlan.findById(id).populate('vehicleTypeId facilityId').lean() as any;
    if (!plan) {
      throw new AppError('Pricing plan not found', 404);
    }
    return plan;
  }

  static async getAllPricingPlans(filters: any = {}, skip = 0, limit = 10): Promise<{ pricingPlans: IPricingPlan[]; total: number }> {
    const query = { isDeleted: false, ...filters };
    const pricingPlans = await PricingPlan.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('vehicleTypeId facilityId')
      .lean() as any;
    const total = await PricingPlan.countDocuments(query);
    return { pricingPlans, total };
  }

  static async getActiveSessionCount(pricingPlanId: string): Promise<number> {
    const count = await ParkingSession.countDocuments({
      pricingPlanId,
      status: { $in: ['active', 'exception'] },
    });
    return count;
  }
}
