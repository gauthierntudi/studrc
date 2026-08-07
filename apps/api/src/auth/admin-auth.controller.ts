import {
  Body,
  Controller,
  Get,
  Ip,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { AdminAuthService } from './admin-auth.service';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import type { AdminAuthUser } from './strategies/jwt-admin.strategy';
import { UpdateAdminProfileDto } from './dto/admin-staff.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAdminGuard } from './guards/jwt-admin.guard';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    return this.adminAuth.login(dto, res, ip);
  }

  @Post('refresh')
  refresh(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.adminAuth.refresh(req.cookies?.admin_refresh_token, res);
  }

  @Post('logout')
  logout(
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.adminAuth.logout(res, req.cookies?.admin_access_token);
  }

  @UseGuards(JwtAdminGuard)
  @Get('me')
  me(@CurrentAdmin() admin: AdminAuthUser) {
    return this.adminAuth.me(admin.id);
  }

  @UseGuards(JwtAdminGuard)
  @Patch('me')
  updateMe(
    @CurrentAdmin() admin: AdminAuthUser,
    @Body() dto: UpdateAdminProfileDto,
  ) {
    return this.adminAuth.updateProfile(admin.id, dto);
  }

  @UseGuards(JwtAdminGuard)
  @Post('me/password')
  changePassword(
    @CurrentAdmin() admin: AdminAuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.adminAuth.changePassword(admin.id, dto);
  }

  @UseGuards(JwtAdminGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2_000_000 },
    }),
  )
  uploadAvatar(
    @CurrentAdmin() admin: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.adminAuth.uploadAvatar(admin.id, file);
  }
}
