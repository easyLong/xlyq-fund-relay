import { Body, Controller, Post } from '@nestjs/common';
import { ok } from '../../common/response';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() input: LoginDto) {
    return ok(await this.authService.login(input.username, input.password));
  }
}
