import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';

export class RoleController {
  static async getAllRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await RoleService.getAllRoles();
      res.status(200).json({ success: true, data: roles });
    } catch (error) {
      next(error);
    }
  }

  static async getRoleById(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await RoleService.getRoleById(req.params.id as string);
      res.status(200).json({ success: true, data: role });
    } catch (error) {
      next(error);
    }
  }

  static async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await RoleService.createRole(req.body);
      res.status(201).json({ success: true, data: role });
    } catch (error) {
      next(error);
    }
  }

  static async updatePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const { permissions } = req.body;
      const role = await RoleService.updatePermissions(id, permissions);
      res.status(200).json({ success: true, data: role });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.deleteRole(req.params.id as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async assignRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, roleCode, customPermissions } = req.body;
      const user = await RoleService.assignRole(userId, roleCode, customPermissions);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  static async getUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await RoleService.getUserPermissions(req.params.userId as string);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async resetPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await RoleService.resetPermissionsToDefault(req.params.id as string);
      res.status(200).json({ success: true, data: role });
    } catch (error) {
      next(error);
    }
  }
}
