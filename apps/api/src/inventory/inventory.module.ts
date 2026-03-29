import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { JournalModule } from "../journal/journal.module";

@Module({
  imports: [JournalModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
