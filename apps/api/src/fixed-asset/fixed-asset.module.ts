import { Module } from "@nestjs/common";
import { FixedAssetController } from "./fixed-asset.controller";
import { FixedAssetService } from "./fixed-asset.service";

@Module({
  controllers: [FixedAssetController],
  providers: [FixedAssetService],
})
export class FixedAssetModule {}
