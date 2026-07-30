import { useState, useEffect } from "react";
import { toast } from "sonner";
import { exceptionService, ExceptionType } from "../../../../services/exception.service";
import { sessionService } from "../../../../services/session.service";
import { pricingService } from "../../../../services/pricing.service";

export function useGlobalExceptionLogic(currentSession: any, coPlateCam: string, checkOutImage: string | null | undefined, onClose: () => void, onExceptionCreated?: () => void) {
  const [exceptionType, setExceptionType] = useState<ExceptionType>(ExceptionType.WRONG_PLATE);
  const [note, setNote] = useState("");
  const [surcharge, setSurcharge] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchedSession, setSearchedSession] = useState<any>(null);

  const activeSession = searchedSession || currentSession;
  const [lostCardFee, setLostCardFee] = useState<number>(0);
  const [isFetchingFee, setIsFetchingFee] = useState(false);

  useEffect(() => {
    if (activeSession?.pricingPlanId?._id && exceptionType === ExceptionType.LOST_CARD) {
      const fetchFee = async () => {
        setIsFetchingFee(true);
        try {
          const res = await pricingService.getById(activeSession.pricingPlanId._id);
          setLostCardFee(res.data.lostCardFee || 0);
        } catch { setLostCardFee(0); }
        finally { setIsFetchingFee(false); }
      };
      fetchFee();
    }
  }, [activeSession, exceptionType]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast.error("Vui lòng nhập Biển số hoặc Mã vé!"); return; }
    setIsSearching(true); setSearchedSession(null);
    try {
      const queryStr = searchQuery.trim().toUpperCase();
      let searchParams: any = { licensePlate: queryStr };
      if (queryStr.startsWith("PS-")) searchParams = { code: queryStr };
      else if (queryStr.startsWith("CARD-")) searchParams = { cardCode: queryStr };
      const res = await sessionService.searchSession(searchParams);
      if (res.success && res.data) { setSearchedSession(res.data); toast.success("Tìm thấy phiên gửi xe hợp lệ!"); }
      else toast.error("Không tìm thấy phiên xe đang hoạt động!");
    } catch (error: any) { toast.error(error.message || "Không tìm thấy phiên gửi xe!"); }
    finally { setIsSearching(false); }
  };

  const handleSubmit = async () => {
    const sessionId = activeSession?._id;
    if (!sessionId) { toast.error("Không xác định được phiên gửi xe. Vui lòng tìm kiếm vé trước khi báo sự cố!"); return; }
    if (!note.trim()) { toast.error("Vui lòng mô tả chi tiết tình huống sự cố!"); return; }
    setIsSubmitting(true);
    try {
      const payload: any = { 
        sessionId, 
        type: exceptionType, 
        description: note.trim(),
        expectedPlate: activeSession.licensePlate || undefined,
        actualPlate: (coPlateCam || activeSession.licensePlate) || undefined,
        ...(activeSession.checkInImage ? { checkInImage: activeSession.checkInImage } : {}),
        ...((checkOutImage || activeSession.checkOutImage) ? { checkOutImage: checkOutImage || activeSession.checkOutImage } : {}),
        ...(activeSession.cardCode ? { cardCode: activeSession.cardCode } : {}),
      };
      if (exceptionType === ExceptionType.LOST_CARD && lostCardFee === 0 && surcharge !== "") payload.surcharge = Number(surcharge);
      else if (exceptionType !== ExceptionType.LOST_CARD && surcharge !== "") payload.surcharge = Number(surcharge);
      await exceptionService.createException(payload);
      toast.success("Đã gửi sự cố thành công! Đang chờ Quản lý duyệt.");
      if (onExceptionCreated) onExceptionCreated();
      onClose();
    } catch (error: any) { toast.error(error.message || "Lỗi khi gửi sự cố, thử lại sau!"); }
    finally { setIsSubmitting(false); }
  };

  return {
    exceptionType, setExceptionType, note, setNote, surcharge, setSurcharge, isSubmitting,
    searchQuery, setSearchQuery, isSearching, searchedSession, setSearchedSession, activeSession,
    lostCardFee, isFetchingFee, handleSearch, handleSubmit
  };
}
