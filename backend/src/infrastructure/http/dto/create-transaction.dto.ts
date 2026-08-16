import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CustomerDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  fullName!: string;

  @IsEmail()
  @Length(1, 254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  phone!: string;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  documentType?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  documentNumber?: string;
}

export class DeliveryDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 32)
  recipientPhone!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  department!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  postalCode?: string;
}

export class CreateTransactionDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  idempotencyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  baseFeeInCents!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  shippingFeeInCents!: number;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;
}
