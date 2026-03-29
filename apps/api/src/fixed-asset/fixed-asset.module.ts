import { Module } from "@nestjs/common";
import { FixedAssetController } from "./fixed-asset.controller";
import { FixedAssetService } from "./fixed-asset.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [FixedAssetController],
  providers: [FixedAssetService],
})
export class FixedAssetModule {}
