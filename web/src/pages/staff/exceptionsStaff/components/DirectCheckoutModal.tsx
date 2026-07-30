import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Camera, Receipt, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, getImageUrl } from '../../../../services/api';
import { sessionService } from '../../../../services/session.service';
import { paymentService } from '../../../../services/payment.service';
import { formatCurrency } from '../../../../utils/format';

interface DirectCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess: () => void;
}

export function DirectCheckoutModal({
  isOpen,
  onClose,
  sessionId,
  onSuccess,
}: DirectCheckoutModalProps) {
  const [feeData, setFeeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submittingType, setSubmittingType] = useState<'cash' | 'momo' | null>(null);
  const [checkoutImage, setCheckoutImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [momoQR, setMomoQR] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [transactionCode, setTransactionCode] = useState<string | null>(null);
  const [momoSuccess, setMomoSuccess] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPolling && transactionCode) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await paymentService.checkStatus(transactionCode);
          if (res?.success && res?.data?.isPaid) {
            setMomoSuccess(true);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setTimeout(() => {
              toast.success('Khách đã thanh toán Momo thành công!');
              setMomoQR(null);
              setIsPolling(false);
              setMomoSuccess(false);
              onSuccess();
            }, 2000);
          }
        } catch (error) {
          // Ignore polling errors
        }
      }, 3000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isPolling, transactionCode]);

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchFee();
    } else {
      setFeeData(null);
      setCheckoutImage(null);
    }
  }, [isOpen, sessionId]);

  const fetchFee = async () => {
    setIsLoading(true);
    try {
      const res = await sessionService.calculateFee(sessionId);
      if (res.success) {
        setFeeData(res.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi tính phí');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setCheckoutImage(localUrl); // Optimistic UI
    setIsUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      // Assuming API_BASE_URL handles /upload/image
      const response: any = await apiClient.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.success && response.data?.imageUrl) {
        setCheckoutImage(response.data.imageUrl);
      }
    } catch (error: any) {
      toast.error('Lỗi khi tải ảnh lên, vui lòng thử lại.');
      setCheckoutImage(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCashCheckOut = async () => {
    setSubmittingType('cash');
    try {
      const gateOut = sessionStorage.getItem('staff_gate_name') || 'Cổng Ra';
      const res = await paymentService.cashCheckout({
        sessionId,
        gateOut,
        checkOutImage: checkoutImage || undefined,
      });

      if (res.success) {
        toast.success('Đã checkout thành công!');
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi checkout');
    } finally {
      setSubmittingType(null);
    }
  };

  const handleMomoCheckOut = async () => {
    setSubmittingType('momo');
    try {
      const gateOut = sessionStorage.getItem('staff_gate_name') || 'Cổng Ra';
      const res = await paymentService.createIntent({
        sessionId,
        method: 'e_wallet',
        checkOutImage: checkoutImage || undefined,
        gateOut,
      });
      if (res.success && (res.data?.qrCodeUrl || res.data?.paymentUrl)) {
        const finalQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(res.data.qrCodeUrl || res.data.paymentUrl)}`;
        setMomoQR(finalQrUrl);
        setTransactionCode(res.data.payment.transactionCode);
        setIsPolling(true);
      } else {
        toast.error('Không thể tạo mã QR Momo!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi khi tạo giao dịch Momo');
    } finally {
      setSubmittingType(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-[18px] font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gray-700" />
            Checkout Trực Tiếp
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-gray-500 font-medium">Đang tính phí...</p>
            </div>
          ) : feeData ? (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Phí gửi xe:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(
                      feeData.details?.baseFee +
                        feeData.details?.overnightFee +
                        feeData.details?.overtimeFee || 0
                    )}
                  </span>
                </div>
                {feeData.details?.exceptionSurcharge > 0 && (
                  <div className="flex justify-between items-center text-sm text-red-600">
                    <span className="font-medium">Phụ phí sự cố:</span>
                    <span className="font-semibold">
                      +{formatCurrency(feeData.details.exceptionSurcharge)}
                    </span>
                  </div>
                )}
                {feeData.details?.lostCardFee > 0 && (
                  <div className="flex justify-between items-center text-sm text-orange-600">
                    <span className="font-medium">Phí mất thẻ:</span>
                    <span className="font-semibold">
                      +{formatCurrency(feeData.details.lostCardFee)}
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900">Tổng thu:</span>
                  <span className="text-xl font-black text-[#1d7a4a]">
                    {formatCurrency(feeData.totalFee)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ảnh xe lúc ra (Tùy chọn)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />

                {checkoutImage ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-gray-200 group">
                    <img
                      src={getImageUrl(checkoutImage)}
                      alt="Checkout"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-gray-50 transition-colors"
                      >
                        Chụp lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-3 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <Camera className="w-6 h-6 text-gray-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">
                          Nhấn để chụp ảnh (Không bắt buộc)
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-red-500">Không thể lấy thông tin phí</div>
          )}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-2">
          <button
            onClick={handleCashCheckOut}
            disabled={submittingType !== null || isLoading || !feeData || isUploading}
            className={`flex-1 h-12 font-bold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-2 ${feeData?.totalFee === 0 ? 'bg-[#A3E635] hover:bg-[#84CC16] text-[#1A202C]' : 'bg-[#dcdcdc] hover:bg-[#c9c9c9] text-[#333]'}`}
          >
            {submittingType === 'cash' ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {feeData?.totalFee === 0 ? 'Mở barie (0đ)' : 'Tiền Mặt'}
          </button>
          <button
            onClick={handleMomoCheckOut}
            disabled={
              submittingType !== null ||
              isLoading ||
              !feeData ||
              feeData.totalFee === 0 ||
              isUploading
            }
            title={feeData?.totalFee === 0 ? 'Không thể tạo QR Momo cho hóa đơn 0đ' : ''}
            className={`flex-1 h-12 font-bold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-2 ${feeData?.totalFee === 0 ? 'bg-[#fcfcfc] border border-[#e8e9e8] text-[#9b9b9b] cursor-not-allowed' : 'bg-[#A3E635] hover:bg-[#84CC16] text-[#1A202C]'}`}
          >
            {submittingType === 'momo' ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            QR MoMo
          </button>
        </div>
      </div>

      {momoQR && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-[16px]">
          <div className="bg-white rounded-[16px] p-6 w-[90%] max-w-[360px] shadow-2xl border border-pink-100 flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <h3 className="text-[16px] font-bold text-[#A50064] mb-1">Thanh toán Momo</h3>
            <p className="text-[11px] text-gray-500 mb-4 text-center">
              Tài xế sử dụng ứng dụng Momo hoặc ngân hàng để quét mã QR
            </p>
            <div className="bg-white p-2 rounded-xl border-2 border-pink-100 shadow-inner mb-4">
              <img src={momoQR} alt="Momo QR Code" className="w-40 h-40 object-contain" />
            </div>
            <div
              className={`flex items-center gap-2 text-[11px] font-medium mb-4 px-4 py-2 rounded-full ${momoSuccess ? 'text-green-600 bg-green-50' : 'text-[#A50064] bg-pink-50'}`}
            >
              {momoSuccess ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full bg-green-500 text-white flex items-center justify-center text-[8px] font-bold">
                    ✓
                  </div>
                  Thanh toán thành công!
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang chờ khách thanh toán...
                </>
              )}
            </div>
            <button
              onClick={() => {
                setMomoQR(null);
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              }}
              className="w-full h-12 border border-gray-200 text-gray-600 font-bold text-sm rounded-[6px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> Hủy giao dịch Momo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
