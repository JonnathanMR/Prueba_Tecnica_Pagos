import { Type } from 'class-transformer';
import {
  IsCreditCard,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class TokenizeCardDto {
  @IsString()
  @IsCreditCard()
  number!: string;

  @IsString()
  @Matches(/^\d{3,4}$/)
  cvc!: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])$/)
  expMonth!: string;

  @IsString()
  @Matches(/^\d{2}$/)
  expYear!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  cardHolder!: string;
}

export class ProcessPaymentDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 128)
  cardToken!: string;

  @IsIn(['VISA', 'MASTERCARD', 'UNKNOWN'])
  cardBrand!: 'VISA' | 'MASTERCARD' | 'UNKNOWN';

  @IsString()
  @Matches(/^\d{4}$/)
  cardLastFour!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  installments!: number;

  @IsString()
  @IsNotEmpty()
  acceptanceToken!: string;

  @IsString()
  @IsNotEmpty()
  acceptPersonalAuth!: string;
}
