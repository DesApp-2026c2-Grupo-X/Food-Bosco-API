import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ROLES } from '../config/constants'
import { CurrentUser } from '../config/security/current-user.decorator'
import type { AuthContext } from '../config/security/jwt.service'
import { Roles } from '../config/security/roles.decorator'
import type { PublicCart } from './cart.model'
import { CartOrchestrator } from './cart.orchestrator'
import { AddCartItemDto } from './dto/add-cart-item.dto'
import { UpdateCartItemDto } from './dto/update-cart-item.dto'

@Controller('v1/carts')
@Roles(ROLES.customer)
export class CartController {
  constructor(private readonly orchestrator: CartOrchestrator) {}

  @Get()
  get(@CurrentUser() auth: AuthContext): Promise<PublicCart> {
    return this.orchestrator.getCart(auth.userId ?? '')
  }

  @Post('items')
  addItem(@CurrentUser() auth: AuthContext, @Body() dto: AddCartItemDto): Promise<PublicCart> {
    return this.orchestrator.addItem(auth.userId ?? '', dto)
  }

  @Patch('items/:itemId')
  updateItem(
    @CurrentUser() auth: AuthContext,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<PublicCart> {
    return this.orchestrator.updateItem(auth.userId ?? '', itemId, dto)
  }

  @Delete('items/:itemId')
  removeItem(
    @CurrentUser() auth: AuthContext,
    @Param('itemId') itemId: string,
  ): Promise<PublicCart> {
    return this.orchestrator.removeItem(auth.userId ?? '', itemId)
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() auth: AuthContext): Promise<PublicCart> {
    return this.orchestrator.confirmCart(auth.userId ?? '')
  }
}
