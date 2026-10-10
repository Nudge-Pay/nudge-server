import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { WebAuthnService } from './webauthn.service';
import {
  AuthenticateOptionsDto,
  RegistrationResponseDto,
  RegistrationVerifiedDto,
  WebAuthnCredentialDto,
} from './dto';

@ApiTags('webauthn')
@ApiBearerAuth()
@Controller('webauthn')
export class WebAuthnController {
  constructor(private readonly webAuthnService: WebAuthnService) {}

  @Post('register/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get passkey registration options',
    description:
      'Generates WebAuthn registration (attestation) options for the ' +
      'authenticated user and stores the challenge server-side. Rejects ' +
      'with 409 once the per-device credentials limit is reached.',
  })
  @ApiOkResponse({ description: 'PublicKeyCredentialCreationOptionsJSON.' })
  @ApiConflictResponse({ description: 'WEBAUTHN_CREDENTIAL_LIMIT_REACHED.' })
  registerOptions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return this.webAuthnService.generateRegistrationOptions(user);
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify passkey registration',
    description:
      'Verifies the attestation response against the stored challenge and ' +
      'persists the credential on success. An optional `deviceName` may be ' +
      'included to label the passkey in the device management list.',
  })
  @ApiOkResponse({ type: RegistrationVerifiedDto })
  @ApiBadRequestResponse({
    description: 'WEBAUTHN_VERIFICATION_FAILED or WEBAUTHN_CHALLENGE_EXPIRED.',
  })
  registerVerify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegistrationResponseDto,
  ): Promise<RegistrationVerifiedDto> {
    const { deviceName, ...response } = body;
    return this.webAuthnService.verifyRegistration(
      user,
      response as unknown as RegistrationResponseJSON,
      deviceName,
    );
  }

  @Get('credentials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List the authenticated user\u2019s registered passkeys',
    description:
      'Returns device management data for every passkey the user has ' +
      'registered. Does not include the raw credential ID or public key.',
  })
  @ApiOkResponse({ type: WebAuthnCredentialDto, isArray: true })
  async listCredentials(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WebAuthnCredentialDto[]> {
    const credentials = await this.webAuthnService.listCredentials(user);
    return credentials.map((c) => ({
      id: c.id,
      deviceName: c.deviceName,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt ? c.lastUsedAt.toISOString() : null,
    }));
  }

  @Delete('credentials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke a registered passkey',
    description:
      'Deletes a passkey the user no longer controls (e.g. a lost or ' +
      'replaced device). Refuses to remove the user\u2019s last remaining ' +
      'credential — register a replacement first.',
  })
  @ApiParam({
    name: 'id',
    description: 'Credential record UUID',
    format: 'uuid',
  })
  @ApiNoContentResponse({ description: 'Credential revoked.' })
  @ApiNotFoundResponse({ description: 'WEBAUTHN_CREDENTIAL_NOT_FOUND.' })
  @ApiConflictResponse({ description: 'WEBAUTHN_LAST_CREDENTIAL.' })
  revokeCredential(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.webAuthnService.revokeCredential(user, id);
  }

  @Post('authenticate/options')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get passkey authentication options for a payment',
    description:
      'Generates WebAuthn authentication (assertion) options bound to a ' +
      'payment and stores the challenge server-side.',
  })
  @ApiOkResponse({ description: 'PublicKeyCredentialRequestOptionsJSON.' })
  @ApiBadRequestResponse({ description: 'WEBAUTHN_NO_CREDENTIALS.' })
  @ApiNotFoundResponse({ description: 'PAYMENT_NOT_FOUND.' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN.' })
  @ApiConflictResponse({ description: 'PAYMENT_INVALID_STATE.' })
  authenticateOptions(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AuthenticateOptionsDto,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return this.webAuthnService.generateAuthenticationOptions(
      user,
      dto.paymentId,
    );
  }
}
