import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_MAX_RATING,
  REVIEW_MIN_RATING,
} from '../order-review.model'

export class CreateOrderReviewDto {
  @IsInt()
  @Min(REVIEW_MIN_RATING)
  @Max(REVIEW_MAX_RATING)
  branchRating!: number

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  branchComment?: string | null

  @IsOptional()
  @IsInt()
  @Min(REVIEW_MIN_RATING)
  @Max(REVIEW_MAX_RATING)
  courierRating?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_COMMENT_MAX_LENGTH)
  courierComment?: string | null
}
