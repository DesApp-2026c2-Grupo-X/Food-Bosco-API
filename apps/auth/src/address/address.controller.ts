import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ERROR_CODES, ROLES } from '../config/constants'
import { DomainException } from '../config/exceptions/domain.exception'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import { AddressService } from './address.service'
import type { AddressListResponse } from './address.service'
import type { PublicAddress } from './address.model'
import { CreateAddressDto } from './dto/create-address.dto'
import { UpdateAddressDto } from './dto/update-address.dto'

@Controller('v1/addresses')
@Roles(ROLES.customer)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  list(@CurrentUser() auth: AuthContext): Promise<AddressListResponse> {
    return this.addressService.listByUser(auth.userId ?? '')
  }

  @Post()
  create(@CurrentUser() auth: AuthContext, @Body() dto: CreateAddressDto): Promise<PublicAddress> {
    return this.addressService.create(auth.userId ?? '', dto)
  }

  @Get(':addressId')
  async get(
    @CurrentUser() auth: AuthContext,
    @Param('addressId') addressId: string,
  ): Promise<PublicAddress> {
    const address = await this.addressService.findOwned(addressId, auth.userId ?? '')
    if (!address) {
      throw new DomainException(ERROR_CODES.addressNotFound, 'Dirección no encontrada', 404)
    }
    return address
  }

  @Patch(':addressId')
  async update(
    @CurrentUser() auth: AuthContext,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<PublicAddress> {
    const address = await this.addressService.update(addressId, auth.userId ?? '', dto)
    if (!address) {
      throw new DomainException(ERROR_CODES.addressNotFound, 'Dirección no encontrada', 404)
    }
    return address
  }

  @Delete(':addressId')
  async remove(
    @CurrentUser() auth: AuthContext,
    @Param('addressId') addressId: string,
  ): Promise<{ ok: boolean }> {
    const removed = await this.addressService.remove(addressId, auth.userId ?? '')
    if (!removed) {
      throw new DomainException(ERROR_CODES.addressNotFound, 'Dirección no encontrada', 404)
    }
    return { ok: true }
  }
}
