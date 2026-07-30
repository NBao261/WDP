import { useState, useEffect } from "react";
import { toast } from "sonner";
import { sessionService } from "../../../../services/session.service";
import { exceptionService, ExceptionType } from "../../../../services/exception.service";
import { pricingService } from "../../../../services/pricing.service";

export function useCreateExceptionLogic(onClose: () => void, onSuccess: () => void) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundSession, setFoundSession] = useState<any>(null);
  const [exceptionType, setExceptionType] = useState<ExceptionType>(ExceptionType.OTHER);
  const [description, setDescription] = useState("");
  const [surcharge, setSurcharge] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lostCardFee, setLostCardFee] = useState<number>(0);
  const [isFetchingFee, setIsFetchingFee] = useState(false);

  useEffect(() => {
    if (foundSession?.pricingPlanId?._id && exceptionType === ExceptionType.LOST_CARD) {
      const fetchFee = async () => {
        setIsFetchingFee(true);
        try {
          const res = await pricingService.getById(foundSession.pricingPlanId._id);
          setLostCardFee(res.data.lostCardFee || 0);
        } catch { setLostCardFee(0); }
        finally { setIsFetchingFee(false); }
      };
      fetchFee();
    }
  }, [foundSession, exceptionType]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast.error("Vui lòng nhập Biển số hoặc Mã vé!"); return; }
    setIsSearching(true); setFoundSession(null);
    try {
      const queryStr = searchQuery.trim().toUpperCase();
      let searchParams: any = { licensePlate: queryStr };
      if (queryStr.startsWith("PS-")) searchParams = { code: queryStr };
      else if (queryStr.startsWith("CARD-")) searchParams = { cardCode: queryStr };
      const res = await sessionService.searchSession(searchParams);
      if (res.success && res.data) { setFoundSession(res.data); toast.success("Tìm thấy phiên gửi xe hợp lệ!"); }
      else toast.error("Không tìm thấy phiên xe đang hoạt động!");
    } catch (error: any) { toast.error(error.message || "Không tìm thấy phiên gửi xe!"); }
    finally { setIsSearching(false); }
  };

  const handleSubmit = async () => {
    if (!foundSession?._id) { toast.error("Vui lòng tìm và chọn phiên gửi xe trước!"); return; }
    if (!description.trim()) { toast.error("Vui lòng nhập mô tả sự cố!"); return; }
    setIsSubmitting(true);
    try {
      const payload: any = { 
        sessionId: foundSession._id, 
        type: exceptionType, 
        description: description.trim(),
        expectedPlate: foundSession.licensePlate || undefined,
        ...(foundSession.checkInImage ? { checkInImage: foundSession.checkInImage } : {}),
        ...(foundSession.cardCode ? { cardCode: foundSession.cardCode } : {}),
      };
      if (exceptionType === ExceptionType.LOST_CARD && lostCardFee === 0 && surcharge !== "") payload.surcharge = Number(surcharge);
      else if (exceptionType !== ExceptionType.LOST_CARD && surcharge !== "") payload.surcharge = Number(surcharge);
      await exceptionService.createException(payload);
      toast.success("Đã tạo báo cáo sự cố thành công!");
      onSuccess(); onClose();
    } catch (error: any) { toast.error(error.message || "Lỗi khi tạo sự cố!"); }
    finally { setIsSubmitting(false); }
  };

  const handleReset = () => {
    setSearchQuery(""); setFoundSession(null); setExceptionType(ExceptionType.OTHER);
    setDescription(""); setSurcharge("");
  };

  return {
    searchQuery, setSearchQuery, isSearching, foundSession, exceptionType, setExceptionType,
    description, setDescription, surcharge, setSurcharge, isSubmitting, lostCardFee, isFetchingFee,
    handleSearch, handleSubmit, handleReset
  };
}
