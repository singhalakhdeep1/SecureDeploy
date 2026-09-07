import { IsNotEmpty, IsString } from 'class-validator';

export class ScanRequest {
  @IsString()
  @IsNotEmpty()
  image: string;
}
