import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AppointmentsService } from '../application/appointments.service';
import { CalendarConnectionService } from '../application/calendar-connection.service';
import {
  bookAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
  type BookAppointmentInput,
  type ListAppointmentsQuery,
  type UpdateAppointmentInput,
} from '../application/dto';

@Controller('appointments')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('appointments:read')
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly calendarConnection: CalendarConnectionService,
  ) {}

  @Get()
  list(@TenantId() tenantId: string, @Query(new ZodValidationPipe(listAppointmentsSchema)) query: ListAppointmentsQuery) {
    return this.appointments.list(tenantId, query);
  }

  @Get('calendar/auth-url')
  @RequirePermission('appointments:manage')
  async getCalendarAuthUrl(@TenantId() tenantId: string, @Query('lawyerId', ParseUUIDPipe) lawyerId: string) {
    if (!this.calendarConnection.isConfigured()) {
      return { configured: false, url: null };
    }
    const url = await this.calendarConnection.getAuthUrl(tenantId, lawyerId);
    return { configured: true, url };
  }

  @Get('calendar/callback')
  async calendarCallback(
    @Query('state') state: string,
    @Query('code') code: string,
  ) {
    const { tenantId, lawyerId } = this.calendarConnection.decodeState(state);
    const status = await this.calendarConnection.connect(tenantId, lawyerId, code);
    return { connected: status.connected, calendarId: status.calendarId };
  }

  @Get('calendar/status')
  @RequirePermission('appointments:read')
  async getCalendarStatus(@TenantId() tenantId: string, @Query('lawyerId', ParseUUIDPipe) lawyerId: string) {
    const status = await this.calendarConnection.getStatus(tenantId, lawyerId);
    return { configured: this.calendarConnection.isConfigured(), ...status };
  }

  @Delete('calendar/disconnect')
  @RequirePermission('appointments:manage')
  async disconnectCalendar(@TenantId() tenantId: string, @Query('lawyerId', ParseUUIDPipe) lawyerId: string) {
    await this.calendarConnection.disconnect(tenantId, lawyerId);
    return { connected: false };
  }

  @Get(':id')
  async getById(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    const found = await this.appointments.getById(tenantId, id);
    if (!found) throw new NotFoundException('appointment not found');
    return found;
  }

  @Post()
  @RequirePermission('appointments:manage')
  book(@TenantId() tenantId: string, @Body(new ZodValidationPipe(bookAppointmentSchema)) body: BookAppointmentInput) {
    return this.appointments.book(tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('appointments:manage')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
  ) {
    return this.appointments.update(tenantId, id, body);
  }
}