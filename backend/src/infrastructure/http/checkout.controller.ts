import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { GetTransactionUseCase } from '../../application/checkout/get-transaction.use-case';
import { CreateTransactionUseCase } from '../../application/checkout/create-transaction.use-case';
import { ProcessPaymentUseCase } from '../../application/checkout/process-payment.use-case';
import { PAYMENT_GATEWAY } from '../../application/checkout/checkout.module';
import type { PaymentGatewayPort } from '../../domain/transaction/payment-gateway.port';
import type { PaymentTransaction } from '../../domain/transaction/payment-transaction';
import type { Delivery } from '../../domain/delivery/delivery';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ProcessPaymentDto, TokenizeCardDto } from './dto/process-payment.dto';

@Controller('checkout')
@ApiTags('Checkout')
export class CheckoutController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly processPayment: ProcessPaymentUseCase,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGatewayPort,
  ) {}

  @Get('acceptance-data')
  @ApiOperation({ summary: 'Get payment acceptance data' })
  @ApiOkResponse({ description: 'Returns the acceptance tokens and contract links required before payment.' })
  async acceptanceData(): Promise<{ data: Awaited<ReturnType<PaymentGatewayPort['getAcceptanceData']>> }> {
    return { data: await this.paymentGateway.getAcceptanceData() };
  }

  @Post('cards/tokenize')
  @ApiOperation({ summary: 'Tokenize a card using the sandbox gateway' })
  @ApiCreatedResponse({ description: 'Returns a short-lived card token. Card data is never persisted.' })
  @ApiBadRequestResponse({ description: 'The card payload is invalid.' })
  async tokenizeCard(@Body() dto: TokenizeCardDto): Promise<{ data: { token: string; brand: string; lastFour: string } }> {
    const tokenizedCard = await this.paymentGateway.tokenizeCard(dto);
    return { data: tokenizedCard };
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create an idempotent pending checkout transaction' })
  @ApiCreatedResponse({ description: 'Returns the created transaction and delivery, or the existing transaction for the same idempotency key.' })
  @ApiBadRequestResponse({ description: 'The checkout payload is invalid.' })
  @ApiConflictResponse({ description: 'The product is inactive or out of stock.' })
  async create(@Body() dto: CreateTransactionDto): Promise<{ data: TransactionResponse; reused: boolean }> {
    const result = await this.createTransaction.execute({
      productId: dto.productId,
      idempotencyKey: dto.idempotencyKey,
      baseFeeInCents: dto.baseFeeInCents,
      shippingFeeInCents: dto.shippingFeeInCents,
      customer: {
        fullName: dto.customer.fullName,
        email: dto.customer.email,
        phone: dto.customer.phone,
        documentType: dto.customer.documentType ?? null,
        documentNumber: dto.customer.documentNumber ?? null,
      },
      delivery: {
        recipientName: dto.delivery.recipientName,
        recipientPhone: dto.delivery.recipientPhone,
        addressLine1: dto.delivery.addressLine1,
        addressLine2: dto.delivery.addressLine2 ?? null,
        city: dto.delivery.city,
        department: dto.delivery.department,
        country: dto.delivery.country === undefined ? 'CO' : assertColombia(dto.delivery.country),
        postalCode: dto.delivery.postalCode ?? null,
      },
    });

    if (!result.ok) throwResult(result.error.code, result.error.message);
    return { data: toTransactionResponse(result.value.transaction, result.value.delivery), reused: result.value.reused };
  }

  @Get('transactions/:transactionId')
  @ApiOperation({ summary: 'Get a checkout transaction by ID' })
  @ApiParam({ name: 'transactionId', format: 'uuid' })
  @ApiOkResponse({ description: 'Returns the transaction and delivery status.' })
  @ApiNotFoundResponse({ description: 'The transaction does not exist.' })
  async get(@Param('transactionId', new ParseUUIDPipe()) transactionId: string): Promise<{ data: TransactionResponse }> {
    const result = await this.getTransaction.execute(transactionId);
    if (!result.ok) throwResult(result.error.code, result.error.message);
    return { data: toTransactionResponse(result.value.transaction, result.value.delivery) };
  }

  @Post('transactions/:transactionId/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a tokenized card payment' })
  @ApiParam({ name: 'transactionId', format: 'uuid' })
  @ApiOkResponse({ description: 'Returns the payment result and updated checkout status.' })
  @ApiBadRequestResponse({ description: 'The payment payload is invalid.' })
  @ApiNotFoundResponse({ description: 'The transaction, customer, or delivery does not exist.' })
  @ApiConflictResponse({ description: 'The stock changed while processing the payment.' })
  async pay(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() dto: ProcessPaymentDto,
    @Req() request: ClientRequest,
  ): Promise<{ data: TransactionResponse; stockUpdated: boolean; reused: boolean }> {
    const result = await this.processPayment.execute({
      transactionId,
      cardToken: dto.cardToken,
      paymentMethod: {
        type: 'CARD',
        cardBrand: dto.cardBrand,
        cardLastFour: dto.cardLastFour,
      },
      installments: dto.installments,
      acceptanceToken: dto.acceptanceToken,
      acceptPersonalAuth: dto.acceptPersonalAuth,
      customerIp: request.ip || request.socket.remoteAddress || '127.0.0.1',
    });

    if (!result.ok) throwResult(result.error.code, result.error.message);
    const deliveryResult = await this.getTransaction.execute(transactionId);
    if (!deliveryResult.ok) throwResult(deliveryResult.error.code, deliveryResult.error.message);

    return {
      data: toTransactionResponse(result.value.transaction, deliveryResult.value.delivery),
      stockUpdated: result.value.stockUpdated,
      reused: result.value.reused,
    };
  }
}

interface TransactionResponse {
  readonly id: string;
  readonly reference: string;
  readonly status: string;
  readonly productId: string;
  readonly amounts: {
    readonly productInCents: number;
    readonly baseFeeInCents: number;
    readonly shippingFeeInCents: number;
    readonly totalInCents: number;
  };
  readonly paymentMethod: PaymentTransaction['paymentMethod'];
  readonly failure: { readonly code: string | null; readonly message: string | null };
  readonly delivery: {
    readonly status: string;
    readonly city: string;
    readonly department: string;
  };
}

interface ClientRequest {
  readonly ip?: string;
  readonly socket: { readonly remoteAddress?: string };
}

function assertColombia(country: string): 'CO' {
  if (country !== 'CO') {
    throw new HttpException(
      { error: { code: 'INVALID_DELIVERY_COUNTRY', message: 'Only deliveries in Colombia are supported.' } },
      HttpStatus.BAD_REQUEST,
    );
  }
  return 'CO';
}

function toTransactionResponse(transaction: PaymentTransaction, delivery: Delivery): TransactionResponse {
  return {
    id: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    productId: transaction.productId,
    amounts: {
      productInCents: transaction.productAmountInCents,
      baseFeeInCents: transaction.baseFeeInCents,
      shippingFeeInCents: transaction.shippingFeeInCents,
      totalInCents: transaction.totalAmountInCents,
    },
    paymentMethod: transaction.paymentMethod,
    failure: { code: transaction.failureCode, message: transaction.failureMessage },
    delivery: {
      status: delivery.status,
      city: delivery.city,
      department: delivery.department,
    },
  };
}

function throwResult(code: string, message: string): never {
  const statusByCode: Record<string, HttpStatus> = {
    PRODUCT_NOT_FOUND: HttpStatus.NOT_FOUND,
    TRANSACTION_NOT_FOUND: HttpStatus.NOT_FOUND,
    CUSTOMER_NOT_FOUND: HttpStatus.NOT_FOUND,
    DELIVERY_NOT_FOUND: HttpStatus.NOT_FOUND,
    PRODUCT_INACTIVE: HttpStatus.CONFLICT,
    OUT_OF_STOCK: HttpStatus.CONFLICT,
    INSUFFICIENT_STOCK: HttpStatus.CONFLICT,
    STOCK_VERSION_CONFLICT: HttpStatus.CONFLICT,
    INVALID_TRANSACTION_INPUT: HttpStatus.BAD_REQUEST,
  };

  throw new HttpException(
    { error: { code, message } },
    statusByCode[code] ?? HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
