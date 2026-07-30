import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { UserRole } from '@shared/types';
import { User as UserType, AssignedFacility } from '@/types/user.types';
import { userService } from '@/services/user.service';
import { roleService } from '@/services/role.service';

interface BasicData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

type Step = 1 | 2 | 3 | 4;

/** Roles được phép phân công facility */
const ASSIGNABLE_ROLES: string[] = [UserRole.MANAGER, UserRole.STAFF];

/**
 * Manages all state and logic for the multi-step UserFormModal.
 * Separates business logic from presentation.
 */
export function useUserForm(
  isOpen: boolean,
  user: UserType | undefined,
  onSuccess: () => void,
  onClose: () => void
) {
  const isEdit = !!user;
  const [currentStep, setCurrentStep] = useState<Step>(1);

  const [basicData, setBasicData] = useState<BasicData>({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STAFF);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [customPerms, setCustomPerms] = useState<Set<string>>(new Set());
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadUserPermissions = useCallback(async (userId: string) => {
    setIsLoadingPerms(true);
    try {
      const res = await roleService.getUserPermissions(userId);
      setCustomPerms(new Set(res.data.customPermissions || []));
    } catch {
      setCustomPerms(new Set());
    } finally {
      setIsLoadingPerms(false);
    }
  }, []);

  // Fetch all roles to dynamically compute base permissions
  useEffect(() => {
    roleService
      .getAllRoles()
      .then((res) => setRoles(res.data || []))
      .catch(() => {});
  }, []);

  // Dynamically compute base permissions based on the currently selected role in the form
  const basePerms = useMemo(() => {
    const roleObj = roles.find((r) => r.code === selectedRole);
    return new Set<string>(roleObj?.permissions || []);
  }, [roles, selectedRole]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setError('');
      if (user) {
        setBasicData({ name: user.name, email: user.email, phone: user.phone, password: '' });
        setSelectedRole(user.role as UserRole);
        loadUserPermissions(user._id);
        // Pre-fill selected facilities — user.assignedFacilities có thể là string[] hoặc AssignedFacility[]
        const ids = (user.assignedFacilities ?? []).map((f) =>
          typeof f === 'string' ? f : (f as AssignedFacility)._id
        );
        setSelectedFacilityIds(ids);
      } else {
        setBasicData({ name: '', email: '', phone: '', password: '' });
        setSelectedRole(UserRole.STAFF);
        setCustomPerms(new Set());
        setSelectedFacilityIds([]);
      }
    }
  }, [isOpen, user, loadUserPermissions]);

  const handleTogglePerm = (permId: string) => {
    const next = new Set(customPerms);
    if (next.has(permId)) next.delete(permId);
    else next.add(permId);
    setCustomPerms(next);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      let savedUserId: string;

      if (isEdit && user) {
        await userService.updateUser(user._id, {
          name: basicData.name,
          phone: basicData.phone,
        });
        await roleService.assignRole({
          userId: user._id,
          roleCode: selectedRole,
          customPermissions: Array.from(customPerms),
        });
        savedUserId = user._id;
        toast.success(`Cập nhật tài khoản "${basicData.name}" thành công.`);
      } else {
        const createRes = await userService.createUser({
          name: basicData.name,
          email: basicData.email,
          phone: basicData.phone,
          password: basicData.password,
          role: selectedRole,
        });
        savedUserId = createRes.data._id;
        toast.success(`Tạo tài khoản "${basicData.name}" thành công.`);
      }

      // Phân công tòa nhà (chỉ áp dụng khi TẠO MỚI và admin có chọn tòa nhà).
      // Khi CHỈNH SỬA: dùng Quick-Action "Phân công Tòa nhà" trực tiếp từ bảng User.
      if (
        !isEdit &&
        ASSIGNABLE_ROLES.includes(selectedRole) &&
        savedUserId &&
        selectedFacilityIds.length > 0
      ) {
        await userService.assignFacilities(savedUserId, selectedFacilityIds);
      }

      onSuccess();
      setTimeout(() => onClose(), 200);
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!basicData.name.trim()) {
      errs.name = 'Vui lòng nhập họ và tên';
    } else if (basicData.name.trim().length < 2) {
      errs.name = 'Họ và tên tối thiểu 2 ký tự';
    }

    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    const phoneClean = basicData.phone.trim().replace(/\s+/g, '');
    if (!basicData.phone.trim()) {
      errs.phone = 'Vui lòng nhập số điện thoại';
    } else if (!phoneRegex.test(phoneClean)) {
      errs.phone = 'Số điện thoại không hợp lệ';
    }

    if (!isEdit) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!basicData.email.trim()) {
        errs.email = 'Vui lòng nhập email';
      } else if (!emailRegex.test(basicData.email.trim())) {
        errs.email = 'Email không hợp lệ';
      }

      if (!basicData.password.trim()) {
        errs.password = 'Vui lòng nhập mật khẩu';
      } else if (basicData.password.trim().length < 6) {
        errs.password = 'Mật khẩu tối thiểu 6 ký tự';
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * Step structure:
   * - Create: [1] Thông tin → [2] Vai trò → [3*] Phân công Tòa nhà (nếu Manager/Staff, tùy chọn)
   * - Edit:   [1] Thông tin → [2] Vai trò → [3] Quyền bổ sung
   *           (Phân công Tòa nhà khi Edit → dùng Quick-Action từ bảng User)
   */
  const showFacilityStep = !isEdit && ASSIGNABLE_ROLES.includes(selectedRole);

  const steps = isEdit
    ? [
        { id: 1, label: 'Thông tin' },
        { id: 2, label: 'Vai trò' },
        { id: 3, label: 'Quyền bổ sung' },
      ]
    : [
        { id: 1, label: 'Thông tin' },
        { id: 2, label: 'Vai trò' },
        ...(showFacilityStep ? [{ id: 3, label: 'Tòa nhà (Tùy chọn)' }] : []),
      ];

  const totalSteps = steps.length;

  return {
    isEdit,
    currentStep,
    setCurrentStep,
    basicData,
    setBasicData,
    selectedRole,
    setSelectedRole,
    selectedFacilityIds,
    setSelectedFacilityIds,
    customPerms,
    basePerms,
    handleTogglePerm,
    isLoadingPerms,
    isSubmitting,
    error,
    handleSubmit,
    fieldErrors,
    setFieldErrors,
    validateStep1,
    totalSteps,
    steps,
    showFacilityStep,
  };
}
