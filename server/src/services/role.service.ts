import { Role, IRole } from '../models/role.model';
import { User } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';
import { DEFAULT_PERMISSIONS } from '../config/permissions';
import { delPattern, delCache } from '../config/redis';

export class RoleService {
  static async getAllRoles(): Promise<IRole[]> {
    return await Role.find().lean() as any;
  }

  static async getRoleById(id: string): Promise<IRole> {
    const role = await Role.findById(id).lean() as any;
    if (!role) throw new AppError('Role not found', 404);
    return role;
  }

  static async createRole(data: Partial<IRole>): Promise<IRole> {
    const existing = await Role.findOne({ code: data.code });
    if (existing) {
      throw new AppError(`Role with code '${data.code}' already exists`, 400);
    }

    if (!data.permissions || data.permissions.length === 0) {
      data.permissions = DEFAULT_PERMISSIONS[data.code as string] || [];
    }

    const role = new Role(data);
    await role.save();
    return role;
  }

  static async updatePermissions(id: string, permissions: string[]): Promise<IRole> {
    const role = await Role.findByIdAndUpdate(id, { permissions }, { new: true });
    if (!role) throw new AppError('Role not found', 404);

    await delPattern('permissions:user:*');

    return role;
  }

  static async deleteRole(id: string): Promise<{ message: string }> {
    const role = await Role.findById(id);
    if (!role) throw new AppError('Role not found', 404);

    if (role.isDefault) {
      throw new AppError('Cannot delete a default role', 400);
    }

    const usersWithRole = await User.countDocuments({ role: role.code, isDeleted: false });
    if (usersWithRole > 0) {
      throw new AppError(
        `Cannot delete role '${role.name}': ${usersWithRole} user(s) are still assigned to this role`,
        400,
      );
    }

    await Role.findByIdAndDelete(id);
    return { message: `Role '${role.name}' deleted successfully` };
  }

  static async assignRole(userId: string, roleCode: string, customPermissions?: string[]) {
    const role = await Role.findOne({ code: roleCode }).lean();
    if (!role) throw new AppError('Role not found', 404);

    const updateData: any = { role: roleCode };
    if (customPermissions !== undefined) {
      updateData.customPermissions = customPermissions;
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    if (!user) throw new AppError('User not found', 404);

    await delCache(`permissions:user:${userId}`);

    return user;
  }

  static async getUserPermissions(userId: string): Promise<{
    role: string;
    rolePermissions: string[];
    customPermissions: string[];
    mergedPermissions: string[];
  }> {
    const user = await User.findById(userId).select('role customPermissions');
    if (!user) throw new AppError('User not found', 404);

    const permissionSet = new Set<string>();

    const defaults = DEFAULT_PERMISSIONS[user.role] || [];
    defaults.forEach((p) => permissionSet.add(p));

    const role = await Role.findOne({ code: user.role }).lean();
    const rolePermissions = role?.permissions || [];
    rolePermissions.forEach((p) => permissionSet.add(p));

    const customPermissions = user.customPermissions || [];
    customPermissions.forEach((p) => permissionSet.add(p));

    return {
      role: user.role,
      rolePermissions,
      customPermissions,
      mergedPermissions: Array.from(permissionSet),
    };
  }

  static async resetPermissionsToDefault(id: string): Promise<IRole> {
    const role = await Role.findById(id);
    if (!role) throw new AppError('Role not found', 404);

    const defaultPerms = DEFAULT_PERMISSIONS[role.code] || [];
    role.permissions = defaultPerms;
    await role.save();

    await delPattern('permissions:user:*');

    return role;
  }
}
